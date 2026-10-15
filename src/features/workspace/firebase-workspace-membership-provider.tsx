import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { isFirebaseConfigured } from "@/features/workspace/firebase-env"
import { workspaceErrorMessage } from "@/features/workspace/workspace-errors"
import { WorkspaceMembershipRemoteProvider, useWorkspaceMembers, type WorkspaceMembershipRemoteValue } from "@/features/workspace/workspace-membership"
import type { CreatedInvite, RemoteWorkspace, SignedInProfile } from "@/features/workspace/firebase-workspace"

type AuthStatus = WorkspaceMembershipRemoteValue["authStatus"]
type WorkspaceStatus = WorkspaceMembershipRemoteValue["workspaceStatus"]

/** Network-backed identity is isolated from route chunks so local calendar screens remain offline-capable. */
export function FirebaseWorkspaceMembershipProvider({ children }: { children: ReactNode }) {
  const { setMembers } = useWorkspaceMembers()
  const [authStatus, setAuthStatus] = useState<AuthStatus>(isFirebaseConfigured ? "loading" : "not-configured")
  const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>(isFirebaseConfigured ? "loading" : "none")
  const [authUser, setAuthUser] = useState<SignedInProfile | null>(null)
  const [workspace, setWorkspace] = useState<RemoteWorkspace | null>(null)
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
            setAuthStatus("signed-out")
            setWorkspaceStatus("none")
            setWorkspace(null)
            setMembers([{ id: "A", displayName: "自分" }])
            return
          }

          setAuthStatus("signed-in")
          setWorkspaceStatus("loading")
          setMembers([{ id: "A", displayName: user.displayName, uid: user.uid, email: user.email, photoURL: user.photoURL }])
          unsubscribeWorkspace = service.observeWorkspace(user.uid, nextWorkspace => {
            if (disposed) return
            setWorkspace(nextWorkspace)
            setWorkspaceStatus(nextWorkspace ? "ready" : "none")
            if (nextWorkspace?.members.length) setMembers(nextWorkspace.members)
            else if (!nextWorkspace) {
              setMembers([{ id: "A", displayName: user.displayName, uid: user.uid, email: user.email, photoURL: user.photoURL }])
            }
          }, error => {
            if (disposed) return
            setWorkspaceStatus("error")
            setWorkspace(null)
            setAuthError(workspaceErrorMessage(error))
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
    authError,
    signInWithGoogle,
    signOut,
    createWorkspace,
    createInvite,
    acceptInvite
  }), [authStatus, workspaceStatus, authUser, workspace, authError, signInWithGoogle, signOut, createWorkspace, createInvite, acceptInvite])

  return <WorkspaceMembershipRemoteProvider value={value}>{children}</WorkspaceMembershipRemoteProvider>
}
