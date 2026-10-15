import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export const WORKSPACE_MEMBERS_STORAGE_KEY = "noca.workspace.members.v1"

export type WorkspaceMemberId = "A" | "B"
export type WorkspaceMember = { id: WorkspaceMemberId; displayName: string }

const SOLO_MEMBER: WorkspaceMember = { id: "A", displayName: "自分" }
const DEFAULT_MEMBERS: WorkspaceMember[] = [SOLO_MEMBER]

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

type WorkspaceMembershipValue = {
  members: WorkspaceMember[]
  isPaired: boolean
  setMembers: (members: WorkspaceMember[]) => void
}

const WorkspaceMembershipContext = createContext<WorkspaceMembershipValue | null>(null)

/** Local preview starts with its current user only. A future invite flow will provide both accepted members. */
export function WorkspaceMembershipProvider({ children }: { children: ReactNode }) {
  const [members, setMembersState] = useState<WorkspaceMember[]>(readMembers)

  const setMembers = useCallback((next: WorkspaceMember[]) => {
    setMembersState(next)
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(WORKSPACE_MEMBERS_STORAGE_KEY, JSON.stringify(members))
    } catch {
      // The membership state remains usable for the current page if storage is unavailable.
    }
  }, [members])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== WORKSPACE_MEMBERS_STORAGE_KEY) return
      setMembersState(readMembers())
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  const value = useMemo(() => ({ members, isPaired: members.some(member => member.id === "B"), setMembers }), [members, setMembers])

  return <WorkspaceMembershipContext.Provider value={value}>{children}</WorkspaceMembershipContext.Provider>
}

export function useWorkspaceMembership() {
  const value = useContext(WorkspaceMembershipContext)
  if (!value) throw new Error("useWorkspaceMembership must be used within WorkspaceMembershipProvider")
  return value
}
