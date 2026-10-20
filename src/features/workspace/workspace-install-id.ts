const installIdKey = (workspaceId: string, uid: string) => `noca.sync.install-id.v1:${workspaceId}:${uid}`

export function getWorkspaceInstallId(workspaceId: string, uid: string) {
  const key = installIdKey(workspaceId, uid)
  try {
    const current = localStorage.getItem(key)
    if (current && /^[a-zA-Z0-9_-]{1,128}$/.test(current)) return current
    const installId = crypto.randomUUID()
    localStorage.setItem(key, installId)
    return installId
  } catch {
    return crypto.randomUUID()
  }
}
