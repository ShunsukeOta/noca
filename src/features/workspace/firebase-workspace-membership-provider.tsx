import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { isFirebaseConfigured } from "@/features/workspace/firebase-env"
import { workspaceErrorMessage } from "@/features/workspace/workspace-errors"
import { WorkspaceMembershipRemoteProvider, useWorkspaceMembers, type WorkspaceMembershipRemoteValue } from "@/features/workspace/workspace-membership"
import type { WorkspacePresenceStatus } from "@/features/workspace/workspace-presence-state"
import type { CreatedInvite, RemoteWorkspace, SignedInProfile } from "@/features/workspace/firebase-workspace"

const workspaceCacheKey = (uid: string) => `noca.firebase.workspace.v1:${uid}`

function readWorkspaceCache(uid: string): RemoteWorkspace | null {
  try {
    const raw = localStorage.getItem(workspaceCacheKey(uid))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (!value || typeof value !== "object") return null
    const workspace = value as Partial<RemoteWorkspace>
    if (typeof workspace.id !== "string" || typeof workspace.ownerUid !== "string" ||
      !(workspace.activeInviteHash === null || typeof workspace.activeInviteHash === "string") ||
      !Array.isArray(workspace.members) || workspace.members.length < 1 || workspace.members.length > 2) return null
    const members = workspace.members as Partial<RemoteWorkspace["members"][number]>[]
    if (!members.every(member =>
      (member.id === "A" || member.id === "B") &&
      typeof member.uid === "string" && typeof member.displayName === "string" && member.displayName.trim().length > 0 &&
      (member.role === "owner" || member.role === "member") &&
      (member.email === null || typeof member.email === "string") &&
      (member.photoURL === null || typeof member.photoURL === "string")
    )) return null
    const memberIds = members.map(member => member.id)
    const owner = members.find(member => member.id === "A")
    if (!owner || owner.uid !== workspace.ownerUid || owner.role !== "owner" ||
      !memberIds.includes("A") || new Set(memberIds).size !== memberIds.length ||
      members.some(member => member.id === "B" && member.role !== "member")) return null
    return workspace as RemoteWorkspace
  } catch {
    return null
  }
}

function writeWorkspaceCache(uid: string, workspace: RemoteWorkspace | null) {
  try {
    const key = workspaceCacheKey(uid)
    if (workspace) localStorage.setItem(key, JSON.stringify(workspace))
    else localStorage.removeItem(key)
  } catch {
    // Current membership remains usable even when this browser cannot persist a cache.
  }
}

function isOfflineError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
  return !navigator.onLine || code.includes("unavailable")
}

type AuthStatus = WorkspaceMembershipRemoteValue["authStatus"]
type WorkspaceStatus = WorkspaceMembershipRemoteValue["workspaceStatus"]

/** Network-backed identity is isolated from route chunks so local calendar screens remain offline-capable. */
export function FirebaseWorkspaceMembershipProvider({ children }: { children: ReactNode }) {
  const { setMembers } = useWorkspaceMembers()
  const [authStatus, setAuthStatus] = useState<AuthStatus>(isFirebaseConfigured ? "loading" : "not-configured")
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>(isFirebaseConfigured ? "loading" : "none")
  const [authUser, setAuthUser] = useState<SignedInProfile | null>(null)
  const [workspace, setWorkspace] = useState<RemoteWorkspace | null>(null)
  const [presenceByUid, setPresenceByUid] = useState<Record<string, WorkspacePresenceStatus> | null>(null)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAuthStatus("not-configured")
      setWorkspaceStatus("none")
      return
    }

    let disposed = false
    let unsubscribeAuth: (() => void) | undefined
    let unsubscribeWorkspace: (() => void) | undefined

    const start = async () => {
      try {
        const service = await import("@/features/workspace/firebase-workspace")
        let redirectError: string | null = null
        try {
          await service.resolveRedirectResult()
        } catch (error) {
          redirectError = workspaceErrorMessage(error)
        }
        if (disposed) return

        unsubscribeAuth = service.observeAuth(user => {
          if (disposed) return
          unsubscribeWorkspace?.()
          unsubscribeWorkspace = undefined
          setAuthUser(user)
          setAuthError(redirectError)
          redirectError = null

          if (!user) {
            setAuthError(redirectError)
            setAuthStatus("signed-out")
            setWorkspaceStatus("none")
            setWorkspace(null)
            setMembers([{ id: "A", displayName: "自分" }])
            return
          }

          const cachedWorkspace = readWorkspaceCache(user.uid)
          setAuthStatus("signed-in")
          setWorkspace(cachedWorkspace)
          setWorkspaceStatus(cachedWorkspace ? "ready" : "loading")
          setMembers([{ id: "A", displayName: user.displayName, uid: user.uid, email: user.email, photoURL: user.photoURL }])
          if (cachedWorkspace?.members.length) setMembers(cachedWorkspace.members)
          unsubscribeWorkspace = service.observeWorkspace(user.uid, (nextWorkspace, fromCache) => {
            if (disposed) return
            if (fromCache && !nextWorkspace) {
              const fallback = readWorkspaceCache(user.uid)
              if (fallback) {
                setWorkspace(fallback)
                setWorkspaceStatus("ready")
                setMembers(fallback.members)
              }
              return
            }
            setWorkspace(nextWorkspace)
            setWorkspaceStatus(nextWorkspace ? "ready" : "none")
            writeWorkspaceCache(user.uid, nextWorkspace)
            if (nextWorkspace?.members.length) setMembers(nextWorkspace.members)
            else if (!nextWorkspace) {
              setMembers([{ id: "A", displayName: user.displayName, uid: user.uid, email: user.email, photoURL: user.photoURL }])
            }
          }, error => {
            if (disposed) return
            const fallback = isOfflineError(error) ? readWorkspaceCache(user.uid) : null
            if (fallback) {
              setWorkspace(fallback)
              setWorkspaceStatus("ready")
              setMembers(fallback.members)
              setAuthError(null)
            } else {
              setWorkspaceStatus("error")
              setWorkspace(null)
              writeWorkspaceCache(user.uid, null)
              setMembers([{ id: "A", displayName: user.displayName, uid: user.uid, email: user.email, photoURL: user.photoURL }])
              setAuthError(isOfflineError(error) ? "オフラインのため共有スペースを確認できません。接続後に再試行してください。" : workspaceErrorMessage(error))
            }
          })
        }, error => {
          if (disposed) return
          setAuthStatus("error")
          setWorkspaceStatus("error")
          setAuthError(workspaceErrorMessage(error))
        })
      } catch (error) {
        if (disposed) return
        setAuthStatus("error")
        setWorkspaceStatus("error")
        setAuthError(workspaceErrorMessage(error))
      }
    }

    void start()
    return () => {
      disposed = true
      unsubscribeAuth?.()
      unsubscribeWorkspace?.()
    }
  }, [setMembers])

  const presenceWorkspaceId = workspaceStatus === "ready" ? workspace?.id ?? null : null
  const presenceMemberKey = JSON.stringify(workspace?.members.map(member => member.uid) ?? [])

  useEffect(() => {
    if (!isFirebaseConfigured || authStatus !== "signed-in" || workspaceStatus !== "ready" || !presenceWorkspaceId || !authUser) {
      setPresenceByUid(null)
      return
    }

    let disposed = false
    let unsubscribePresence: (() => void) | undefined
    const memberUids = JSON.parse(presenceMemberKey) as string[]
    setPresenceByUid(null)

    void import("@/features/workspace/firebase-workspace").then(service => {
      if (disposed) return
      unsubscribePresence = service.observeWorkspacePresence(
        presenceWorkspaceId,
        authUser.uid,
        memberUids,
        nextPresence => setPresenceByUid(previous => {
          if (previous && Object.keys(nextPresence).length === Object.keys(previous).length &&
            Object.entries(nextPresence).every(([uid, status]) => previous[uid] === status)) return previous
          return nextPresence
        }),
        () => setPresenceByUid(null)
      )
    }).catch(() => setPresenceByUid(null))

    return () => {
      disposed = true
      unsubscribePresence?.()
    }
  }, [authStatus, authUser, presenceMemberKey, presenceWorkspaceId, workspaceStatus])

  const runService = useCallback(async (method: "signInWithGoogle" | "signOut" | "createWorkspace" | "acceptInvite", token?: string) => {
    if (!isFirebaseConfigured) throw new Error("Firebaseの環境設定がありません。")
    const service = await import("@/features/workspace/firebase-workspace")
    if (method === "signInWithGoogle") return service.signInWithGoogle()
    if (method === "signOut") return service.signOut()
    if (method === "createWorkspace") return service.createWorkspace()
    return service.acceptInvite(token ?? "")
  }, [])

  const signInWithGoogle = useCallback(() => runService("signInWithGoogle"), [runService])
  const signOut = useCallback(() => runService("signOut"), [runService])
  const createWorkspace = useCallback(() => runService("createWorkspace"), [runService])
  const createInvite = useCallback(async (): Promise<CreatedInvite> => {
    if (!isFirebaseConfigured) throw new Error("Firebaseの環境設定がありません。")
    const service = await import("@/features/workspace/firebase-workspace")
    return service.createInvite()
  }, [])
  const acceptInvite = useCallback((token: string) => runService("acceptInvite", token), [runService])

  const value = useMemo<WorkspaceMembershipRemoteValue>(() => ({
    authStatus,
    workspaceStatus,
    authUser,
    workspace,
    presenceByUid,
    authError,
    signInWithGoogle,
    signOut,
    createWorkspace,
    createInvite,
    acceptInvite
  }), [authStatus, workspaceStatus, authUser, workspace, presenceByUid, authError, signInWithGoogle, signOut, createWorkspace, createInvite, acceptInvite])

  return <WorkspaceMembershipRemoteProvider value={value}>{children}</WorkspaceMembershipRemoteProvider>
}
