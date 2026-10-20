export type WorkspacePresenceStatus = "online" | "offline" | "unknown"

export type WorkspacePresenceRecord = {
  uid: string
  online: boolean
  lastSeenAt: number
}

export const WORKSPACE_PRESENCE_STALE_AFTER_MS = 75_000

export function getWorkspacePresenceStatuses(
  memberUids: string[],
  records: WorkspacePresenceRecord[],
  now: number,
  serverConfirmed: boolean
): Record<string, WorkspacePresenceStatus> {
  const statuses = Object.create(null) as Record<string, WorkspacePresenceStatus>
  for (const uid of memberUids) statuses[uid] = serverConfirmed ? "offline" : "unknown"

  for (const record of records) {
    if (record.online && now - record.lastSeenAt <= WORKSPACE_PRESENCE_STALE_AFTER_MS && uidIsMember(record.uid, statuses)) {
      statuses[record.uid] = "online"
    }
  }

  return statuses
}

function uidIsMember(uid: string, statuses: Record<string, WorkspacePresenceStatus>) {
  return Object.prototype.hasOwnProperty.call(statuses, uid)
}
