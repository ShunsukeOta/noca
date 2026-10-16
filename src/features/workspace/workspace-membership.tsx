import { createContext, useContext, useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react"
import { isFirebaseConfigured } from "@/features/workspace/firebase-env"
import type { CreatedInvite, RemoteWorkspace, SignedInProfile } from "@/features/workspace/firebase-workspace"

export const WORKSPACE_MEMBERS_STORAGE_KEY = "noca.workspace.members.v1"

export type WorkspaceMemberId = "A" | "B"
export type WorkspaceMember = { id: WorkspaceMemberId; displayName: string; uid?: string; email?: string | null; photoURL?: string | null; role?: "owner" | "member" }
type WorkspaceStatus = "loading" | "none" | "ready" | "error"
type AuthStatus = "not-configured" | "loading" | "signed-out" | "signed-in" | "error"

export type WorkspaceMembershipRemoteValue = {
  authStatus: AuthStatus
  workspaceStatus: WorkspaceStatus
  authUser: SignedInProfile | null
  workspace: RemoteWorkspace | null
  authError: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  createWorkspace: () => Promise<void>
  createInvite: () => Promise<CreatedInvite>
  acceptInvite: (token: string) => Promise<void>
}

type WorkspaceLocalValue = {
  members: WorkspaceMember[]
  setMembers: Dispatch<SetStateAction<WorkspaceMember[]>>
}

export type WorkspaceMembershipValue = WorkspaceMembershipRemoteValue & {
  members: WorkspaceMember[]
  isPaired: boolean
}

const SOLO_MEMBER: WorkspaceMember = { id: "A", displayName: "自分" }
const DEFAULT_MEMBERS: WorkspaceMember[] = [SOLO_MEMBER]
const WorkspaceLocalContext = createContext<WorkspaceLocalValue | null>(null)
const WorkspaceMembershipContext = createContext<WorkspaceMembershipValue | null>(null)

const missingFirebase = async (): Promise<never> => {
  throw new Error("Firebaseの環境設定がありません。")
}

const LOCAL_PREVIEW: WorkspaceMembershipRemoteValue = {
  authStatus: "not-configured",
  workspaceStatus: "none",
  authUser: null,
  workspace: null,
  authError: null,
  signInWithGoogle: missingFirebase,
  signOut: missingFirebase,
  createWorkspace: missingFirebase,
  createInvite: missingFirebase,
  acceptInvite: missingFirebase
}

function readMembers(): WorkspaceMember[] {
  try {
    const raw = localStorage.getItem(WORKSPACE_MEMBERS_STORAGE_KEY)
    if (raw === null) return DEFAULT_MEMBERS
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > 2) return DEFAULT_MEMBERS
    const members = parsed as Partial<WorkspaceMember>[]
    const ids = members.map(member => member.id)
    if (!ids.includes("A") || ids.some(id => id !== "A" && id !== "B") || new Set(ids).size !== ids.length) return DEFAULT_MEMBERS
    if (!members.every(member => typeof member.displayName === "string" && member.displayName.trim().length > 0)) return DEFAULT_MEMBERS
    return members as WorkspaceMember[]
  } catch {
    return DEFAULT_MEMBERS
  }
}

/** Keeps the local-first owner state separate from the network-only Firebase bridge. */
export function WorkspaceMembershipProvider({ children }: { children: ReactNode }) {
  const [members, setMembers] = useState<WorkspaceMember[]>(() => isFirebaseConfigured ? DEFAULT_MEMBERS : readMembers())
  const localValue = useMemo(() => ({ members, setMembers }), [members])
  const membershipValue = useMemo<WorkspaceMembershipValue>(() => ({
    ...LOCAL_PREVIEW,
    members,
    isPaired: members.some(member => member.id === "B")
  }), [members])

  useEffect(() => {
    if (isFirebaseConfigured) return
    try {
      localStorage.setItem(WORKSPACE_MEMBERS_STORAGE_KEY, JSON.stringify(members))
    } catch {
      // Local preview membership remains usable in the current page if storage is unavailable.
    }
  }, [members])

  useEffect(() => {
    if (isFirebaseConfigured) return
    const sync = (event: StorageEvent) => {
      if (event.key !== WORKSPACE_MEMBERS_STORAGE_KEY) return
      setMembers(readMembers())
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  return (
    <WorkspaceLocalContext.Provider value={localValue}>
      <WorkspaceMembershipContext.Provider value={membershipValue}>{children}</WorkspaceMembershipContext.Provider>
    </WorkspaceLocalContext.Provider>
  )
}

export function WorkspaceMembershipRemoteProvider({ children, value }: { children: ReactNode; value: WorkspaceMembershipRemoteValue }) {
  const local = useWorkspaceMembers()
  const membershipValue = useMemo<WorkspaceMembershipValue>(() => ({
    ...value,
    members: local.members,
    isPaired: local.members.some(member => member.id === "B")
  }), [local.members, value])
  return <WorkspaceMembershipContext.Provider value={membershipValue}>{children}</WorkspaceMembershipContext.Provider>
}

export function useWorkspaceMembers() {
  const value = useContext(WorkspaceLocalContext)
  if (!value) throw new Error("useWorkspaceMembers must be used within WorkspaceMembershipProvider")
  return value
}

export function useWorkspaceMembership() {
  const value = useContext(WorkspaceMembershipContext)
  if (!value) throw new Error("useWorkspaceMembership must be used within WorkspaceMembershipProvider")
  return value
}
