import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type SetStateAction } from "react"
import type { CalendarEvent, Task, TodoCategory } from "@/app/mock-data"
import { isLegacyDemoRecord, isLegacyDemoWorkspaceRecord, removeLegacyDemoEvents, removeLegacyDemoTasks } from "@/features/data/legacy-demo-data"
import { DEFAULT_TODO_CATEGORIES } from "@/features/todos/todo-category-defaults"
import { useWorkspaceMembership } from "@/features/workspace/workspace-membership"
import type { WorkspaceDataSnapshot, WorkspaceMutation, WorkspaceRecord, WorkspaceRecordKind, WorkspaceRecords, WorkspaceSyncConflict, WorkspaceVersions } from "@/features/workspace/firebase-workspace-data"
import { WorkspaceDataSyncContext, type DataSyncStatus, type WorkspaceDataSyncValue } from "@/features/workspace/workspace-data-sync-context"

type RecordUpdater<T> = SetStateAction<T[]>

const TODO_OUTBOX_KEY = "noca.sync.pending.todos.v1"
const CATEGORY_OUTBOX_KEY = "noca.sync.pending.categories.v1"
const EVENT_OUTBOX_KEY = "noca.sync.pending.events.v1"
const importedKey = (workspaceId: string) => `noca.shared-data.imported.v1:${workspaceId}`
const legacyDemoCleanupKey = (workspaceId: string) => `noca.shared-data.demo-cleanup.v1:${workspaceId}`

const emptyRecords: WorkspaceRecords = { todos: [], categories: DEFAULT_TODO_CATEGORIES, events: [] }
const emptyVersions: WorkspaceVersions = { todos: {}, categories: {}, events: {} }

type PendingMutation = WorkspaceMutation
type CacheState = { records: WorkspaceRecords; versions: WorkspaceVersions; conflicts: WorkspaceSyncConflict[]; lastSyncedAt: number | null }

function applyUpdater<T>(current: T[], updater: RecordUpdater<T>) {
  return typeof updater === "function" ? (updater as (current: T[]) => T[])(current) : updater
}
function cacheKey(workspaceId: string) {
  return `noca.shared-data.v1:${workspaceId}`
}

function activeKey(workspaceId: string) {
  return `noca.shared-data.active.v1:${workspaceId}`
}

function installIdKey(workspaceId: string, uid: string) {
  return `noca.sync.install-id.v1:${workspaceId}:${uid}`
}

function outboxKey(workspaceId: string, kind: WorkspaceRecordKind) {
  return `${kind === "todos" ? TODO_OUTBOX_KEY : kind === "categories" ? CATEGORY_OUTBOX_KEY : EVENT_OUTBOX_KEY}:${workspaceId}`
}

function emptySnapshot(): WorkspaceDataSnapshot {
  return { records: emptyRecords, versions: emptyVersions, conflicts: [], fromCache: true }
}

function readCache(workspaceId: string): CacheState {
  try {
    const raw = localStorage.getItem(cacheKey(workspaceId))
    if (!raw) return { records: emptyRecords, versions: emptyVersions, conflicts: [], lastSyncedAt: null }
    const parsed = JSON.parse(raw) as Partial<CacheState>
    if (!parsed.records || !Array.isArray(parsed.records.todos) || !Array.isArray(parsed.records.categories) || !Array.isArray(parsed.records.events)) {
      return { records: emptyRecords, versions: emptyVersions, conflicts: [], lastSyncedAt: null }
    }
    return {
      records: {
        todos: removeLegacyDemoTasks(parsed.records.todos as Task[]),
        categories: parsed.records.categories as TodoCategory[],
        events: removeLegacyDemoEvents(parsed.records.events as CalendarEvent[])
      },
      versions: parsed.versions ?? emptyVersions,
      conflicts: Array.isArray(parsed.conflicts) ? parsed.conflicts as WorkspaceSyncConflict[] : [],
      lastSyncedAt: typeof parsed.lastSyncedAt === "number" ? parsed.lastSyncedAt : null
    }
  } catch {
    return { records: emptyRecords, versions: emptyVersions, conflicts: [], lastSyncedAt: null }
  }
}

function readOutbox(workspaceId: string) {
  const result: PendingMutation[] = []
  try {
    for (const kind of ["todos", "categories", "events"] as const) {
      const raw = localStorage.getItem(outboxKey(workspaceId, kind))
      if (!raw) continue
      const parsed: unknown = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        result.push(...parsed.filter((item): item is PendingMutation =>
          !!item && typeof item === "object" && item.kind === kind &&
          typeof item.entityId === "string" && !item.entityId.includes("/") &&
          typeof item.id === "string" && !item.id.includes("/") &&
          (item.action === "upsert" || item.action === "delete" || item.action === "purge") &&
          (item.action !== "purge" || (kind === "todos" && item.record === null)) &&
          Number.isInteger(item.baseRevision) && item.baseRevision >= 0 &&
          (item.action === "delete" || item.action === "purge" || (!!item.record &&
            !(kind === "todos" && isLegacyDemoRecord("todos", item.record)) &&
            !(kind === "todos" && isLegacyDemoWorkspaceRecord("todos", item.record)) &&
            !(kind === "events" && isLegacyDemoRecord("events", item.record)) &&
            !(kind === "events" && isLegacyDemoWorkspaceRecord("events", item.record))))
        ))
      }
    }
  } catch {
    // A corrupt queue remains isolated to its workspace. The last cloud cache is still readable.
  }
  return result
}

function persistOutbox(workspaceId: string, queue: PendingMutation[]) {
  for (const kind of ["todos", "categories", "events"] as const) {
    const entries = queue.filter(item => item.kind === kind)
    const key = outboxKey(workspaceId, kind)
    if (entries.length) localStorage.setItem(key, JSON.stringify(entries))
    else localStorage.removeItem(key)
  }
}

function persistCache(workspaceId: string, snapshot: CacheState) {
  localStorage.setItem(cacheKey(workspaceId), JSON.stringify(snapshot))
}

function recordsWithMutation(records: WorkspaceRecords, mutation: PendingMutation): WorkspaceRecords {
  const next = { ...records, todos: [...records.todos], categories: [...records.categories], events: [...records.events] }
  const list = mutation.kind === "todos" ? next.todos : mutation.kind === "categories" ? next.categories : next.events
  const index = list.findIndex(item => item.id === mutation.entityId)
  if (mutation.action === "delete" || mutation.action === "purge") {
    if (index >= 0) list.splice(index, 1)
  } else if (mutation.record) {
    if (index >= 0) list.splice(index, 1)
    const insertAt = mutation.kind === "categories" && typeof mutation.sortOrder === "number"
      ? Math.max(0, Math.min(mutation.sortOrder, list.length))
      : index >= 0 ? index : 0
    list.splice(insertAt, 0, mutation.record as never)
  }
  return next
}

function recordsFromMutations(records: WorkspaceRecords, queue: PendingMutation[]) {
  return queue.reduce(recordsWithMutation, records)
}

function recordEqual(left: WorkspaceRecord, right: WorkspaceRecord) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function diffMutations<K extends WorkspaceRecordKind>(
  kind: K,
  previous: WorkspaceRecords[K],
  next: WorkspaceRecords[K],
  versions: WorkspaceVersions,
  queued: PendingMutation[]
) {
  const before = new Map(previous.map(item => [item.id, item]))
  const after = new Map(next.map(item => [item.id, item]))
  const beforeOrder = kind === "categories" ? new Map(previous.map((item, index) => [item.id, index])) : new Map<string, number>()
  const afterOrder = kind === "categories" ? new Map(next.map((item, index) => [item.id, index])) : new Map<string, number>()
  const keys = new Set([...before.keys(), ...after.keys()])
  const mutations: PendingMutation[] = []
  for (const id of keys) {
    const oldRecord = before.get(id)
    const newRecord = after.get(id)
    const orderChanged = kind === "categories" && beforeOrder.get(id) !== afterOrder.get(id)
    if (oldRecord && newRecord && recordEqual(oldRecord, newRecord) && !orderChanged) continue
    const priorQueued = [...queued].reverse().find(item => item.kind === kind && item.entityId === id)
    mutations.push({
      id: crypto.randomUUID(),
      kind,
      entityId: id,
      action: newRecord ? "upsert" : "delete",
      record: (newRecord ?? oldRecord ?? null) as WorkspaceRecord | null,
      sortOrder: !newRecord ? undefined : kind === "categories" ? afterOrder.get(id) : oldRecord ? undefined : Date.now(),
      baseRevision: priorQueued?.baseRevision ?? versions[kind][id] ?? 0,
      queuedAt: Date.now()
    })
  }
  return mutations
}

function formatError(error: unknown) {
  const code = error && typeof error === "object" && "code" in error ? String(error.code) : ""
  if (!navigator.onLine || code.includes("unavailable")) return "オフラインです。変更はこの端末に保管し、接続時に同期します。"
  if (code.includes("permission-denied")) return "共有データへアクセスできません。Firebaseの権限設定を確認してください。"
  return "共有データを同期できませんでした。接続を確認して再試行してください。"
}

function toWorkspaceRecords(snapshot: WorkspaceDataSnapshot): WorkspaceDataSnapshot {
  return snapshot
}

export function WorkspaceDataSyncProvider({ children }: { children: ReactNode }) {
  const membership = useWorkspaceMembership()
  const workspaceId = membership.workspace?.id ?? null
  const uid = membership.authUser?.uid ?? null
  const workspaceReady = membership.authStatus === "signed-in" && membership.workspaceStatus === "ready" && !!workspaceId && !!uid
  const scope = workspaceReady ? `${workspaceId}:${uid}` : null

  const [status, setStatus] = useState<DataSyncStatus>("local")
  const [activeScope, setActiveScope] = useState<string | null>(null)
  const [records, setRecords] = useState<WorkspaceRecords>(emptyRecords)
  const [versions, setVersions] = useState<WorkspaceVersions>(emptyVersions)
  const [conflicts, setConflicts] = useState<WorkspaceSyncConflict[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [localDataImported, setLocalDataImported] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const recordsRef = useRef(records)
  const versionsRef = useRef(versions)
  const queueRef = useRef<PendingMutation[]>([])
  const activeScopeRef = useRef<string | null>(activeScope)
  const flushPromiseRef = useRef<Promise<void> | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const lastSyncedAtRef = useRef<number | null>(lastSyncedAt)
  recordsRef.current = records
  versionsRef.current = versions
  activeScopeRef.current = activeScope
  lastSyncedAtRef.current = lastSyncedAt

  const isActive = !!scope && activeScope === scope

  const setSnapshot = useCallback((snapshot: WorkspaceDataSnapshot, keepPending = true, persistedLocalCache = false) => {
    if (!persistedLocalCache && snapshot.fromCache && workspaceId) {
      const cached = readCache(workspaceId)
      if (cached.lastSyncedAt !== null) {
        // Firestore's in-memory cache can be empty after a reload/offline launch.
        // Keep the app's durable last-known snapshot until a server snapshot arrives.
        setStatus(navigator.onLine ? "loading" : "offline")
        return
      }
    }
    const queue = keepPending ? queueRef.current : []
    const nextRecords = recordsFromMutations(snapshot.records, queue)
    recordsRef.current = nextRecords
    versionsRef.current = snapshot.versions
    setRecords(nextRecords)
    setVersions(snapshot.versions)
    setConflicts(snapshot.conflicts)
    const syncedAt = snapshot.fromCache ? lastSyncedAtRef.current : Date.now()
    lastSyncedAtRef.current = syncedAt
    setLastSyncedAt(syncedAt)
    if (workspaceId && activeScopeRef.current === scope) {
      try { persistCache(workspaceId, { records: nextRecords, versions: snapshot.versions, conflicts: snapshot.conflicts, lastSyncedAt: syncedAt }) }
      catch { setErrorMessage("共有データの端末内保存に失敗しました。空き容量を確認してください。") }
    }
    if (!snapshot.fromCache && navigator.onLine) {
      setErrorMessage(null)
      setStatus(queue.length ? "syncing" : "synced")
    } else if (!navigator.onLine) setStatus("offline")
    else setStatus("loading")
  }, [workspaceId, scope])

  const loadService = useCallback(async () => import("@/features/workspace/firebase-workspace-data"), [])

  useEffect(() => {
    unsubscribeRef.current?.()
    unsubscribeRef.current = null
    if (!workspaceReady || !workspaceId || !uid || !scope) {
      activeScopeRef.current = null
      setActiveScope(null)
      queueRef.current = []
      setPendingCount(0)
      setLocalDataImported(false)
      setConflicts([])
      setStatus("local")
      setErrorMessage(null)
      return
    }

    let marker = false
    try {
      marker = localStorage.getItem(activeKey(workspaceId)) === "active"
    } catch {
      setStatus("error")
      setErrorMessage("共有設定を読み取れませんでした。")
      return
    }
    if (!marker) {
      activeScopeRef.current = null
      setActiveScope(null)
      setLocalDataImported(false)
      setStatus("setup-required")
      setErrorMessage(null)
      return
    }

    const cache = readCache(workspaceId)
    const cachedSnapshot = { ...emptySnapshot(), records: cache.records, versions: cache.versions, conflicts: cache.conflicts }
    const pending = readOutbox(workspaceId)
    queueRef.current = pending
    activeScopeRef.current = scope
    setActiveScope(scope)
    lastSyncedAtRef.current = cache.lastSyncedAt
    setLastSyncedAt(cache.lastSyncedAt)
    setSnapshot(cachedSnapshot, true, true)
    setPendingCount(pending.length)
    setLocalDataImported(localStorage.getItem(importedKey(workspaceId)) === "done")
    setStatus(navigator.onLine ? "loading" : "offline")
    setErrorMessage(null)
    return () => {
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [workspaceReady, workspaceId, uid, scope, setSnapshot])

  const flushQueue = useCallback(async () => {
    if (flushPromiseRef.current) return flushPromiseRef.current
    if (!isActive || !workspaceId || !uid || !navigator.onLine || queueRef.current.length === 0) return
    const flushScope = scope
    const job = (async () => {
      setStatus("syncing")
      setErrorMessage(null)
      let service: Awaited<ReturnType<typeof loadService>>
      try {
        service = await loadService()
      } catch (error) {
        setErrorMessage(formatError(error))
        setStatus(navigator.onLine ? "error" : "offline")
        return
      }
      let completed = true
      while (queueRef.current.length && navigator.onLine && activeScopeRef.current === flushScope) {
        const current = queueRef.current[0]
        try {
          const result = await service.applyWorkspaceMutation(workspaceId, uid, current)
          if (activeScopeRef.current !== flushScope) {
            const savedQueue = readOutbox(workspaceId).filter(item => item.id !== current.id)
            const nextForEntity = savedQueue.find(item => item.kind === current.kind && item.entityId === current.entityId)
            if (result.status === "saved" && nextForEntity) nextForEntity.baseRevision = result.revision
            persistOutbox(workspaceId, savedQueue)
            return
          }
          const currentQueue = queueRef.current
          if (result.status === "conflict") {
            const laterChange = currentQueue.find(item => item.kind === current.kind && item.entityId === current.entityId && item.id !== current.id)
            const merged = laterChange
              ? await service.mergeWorkspaceConflictLocalChange(workspaceId, uid, current.id, laterChange)
              : false
            queueRef.current = currentQueue.filter(item => item.id !== current.id &&
              (!merged || item.kind !== current.kind || item.entityId !== current.entityId))
            persistOutbox(workspaceId, queueRef.current)
            setPendingCount(queueRef.current.length)
          } else {
            queueRef.current = currentQueue.filter(item => item.id !== current.id)
            const sameEntity = queueRef.current.find(item => item.kind === current.kind && item.entityId === current.entityId)
            if (sameEntity) {
              sameEntity.baseRevision = result.revision
              persistOutbox(workspaceId, queueRef.current)
            } else {
              persistOutbox(workspaceId, queueRef.current)
            }
            versionsRef.current = {
              ...versionsRef.current,
              [current.kind]: { ...versionsRef.current[current.kind], [current.entityId]: result.revision }
            }
            setVersions(versionsRef.current)
            setPendingCount(queueRef.current.length)
          }
        } catch (error) {
          completed = false
          setErrorMessage(formatError(error))
          setStatus(navigator.onLine ? "error" : "offline")
          return
        }
      }
      if (activeScopeRef.current !== flushScope) return
      try {
        const fresh = await service.getWorkspaceData(workspaceId)
        if (activeScopeRef.current !== flushScope) return
        setSnapshot(fresh)
        setStatus(queueRef.current.length ? "syncing" : "synced")
      } catch (error) {
        completed = false
        setErrorMessage(formatError(error))
        setStatus(navigator.onLine ? "error" : "offline")
      }
      if (completed && queueRef.current.length && navigator.onLine && activeScopeRef.current === flushScope) {
        window.setTimeout(() => { void flushQueue() }, 0)
      }
    })()
    flushPromiseRef.current = job
    try { await job } finally { flushPromiseRef.current = null }
  }, [isActive, workspaceId, uid, scope, loadService, setSnapshot])

  useEffect(() => {
    if (!isActive || !workspaceId || !uid) return
    let disposed = false
    const cleanupLegacyDemoData = () => {
      if (!navigator.onLine) return
      try {
        if (localStorage.getItem(legacyDemoCleanupKey(workspaceId)) === "done") return
      } catch {
        return
      }
      void loadService().then(service => service.removeLegacyDemoDataFromWorkspace(workspaceId, uid)).then(completed => {
        if (disposed || !completed) return
        try { localStorage.setItem(legacyDemoCleanupKey(workspaceId), "done") } catch { /* Cleanup is idempotent. */ }
      }).catch(() => {
        // The UI and offline cache already hide the old records. Retry on the
        // next online event if a remote cleanup could not complete.
      })
    }
    cleanupLegacyDemoData()
    window.addEventListener("online", cleanupLegacyDemoData)
    void loadService().then(service => {
      if (disposed) return
      unsubscribeRef.current?.()
      unsubscribeRef.current = service.observeWorkspaceData(workspaceId, snapshot => {
        if (disposed) return
        setSnapshot(snapshot)
        setPendingCount(queueRef.current.length)
        if (!snapshot.fromCache && queueRef.current.length) void flushQueue()
      }, error => {
        if (disposed) return
        setErrorMessage(formatError(error))
        setStatus(navigator.onLine ? "error" : "offline")
      })
    }).catch(error => {
      if (!disposed) {
        setErrorMessage(formatError(error))
        setStatus(navigator.onLine ? "error" : "offline")
      }
    })
    return () => {
      disposed = true
      window.removeEventListener("online", cleanupLegacyDemoData)
      unsubscribeRef.current?.()
      unsubscribeRef.current = null
    }
  }, [isActive, workspaceId, uid, loadService, setSnapshot, flushQueue])

  useEffect(() => {
    if (!isActive) return
    const handleOnline = () => { void flushQueue() }
    const handleOffline = () => setStatus("offline")
    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)
    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [isActive, flushQueue])

  const enqueueChanges = useCallback((kind: WorkspaceRecordKind, previous: WorkspaceRecords[WorkspaceRecordKind], next: WorkspaceRecords[WorkspaceRecordKind]) => {
    if (!workspaceId || !isActive) return
    const changes = diffMutations(kind, previous as never, next as never, versionsRef.current, queueRef.current)
    if (!changes.length) return
    for (const change of changes) {
      const priorIndex = queueRef.current.findIndex(item => item.kind === change.kind && item.entityId === change.entityId)
      if (priorIndex >= 0) queueRef.current.splice(priorIndex, 1)
      queueRef.current.push(change)
    }
    try {
      persistOutbox(workspaceId, queueRef.current)
      setPendingCount(queueRef.current.length)
      setStatus(navigator.onLine ? "syncing" : "offline")
      const updated = { ...recordsRef.current, [kind]: [...next] } as WorkspaceRecords
      recordsRef.current = updated
      setRecords(updated)
      persistCache(workspaceId, { records: updated, versions: versionsRef.current, conflicts: readCache(workspaceId).conflicts, lastSyncedAt: lastSyncedAtRef.current })
      if (navigator.onLine) void flushQueue()
    } catch {
      setErrorMessage("変更をこの端末に保存できませんでした。空き容量を確認してください。")
      setStatus("error")
    }
  }, [workspaceId, isActive, flushQueue])

  const updateTodos = useCallback((updater: RecordUpdater<Task>) => {
    const previous = recordsRef.current.todos
    const next = applyUpdater(previous, updater)
    enqueueChanges("todos", previous, next)
  }, [enqueueChanges])
  const permanentlyDeleteTodo = useCallback((id: string) => {
    if (!workspaceId || !isActive) return
    const task = recordsRef.current.todos.find(item => item.id === id)
    if (!task?.done) return
    const prior = [...queueRef.current].reverse().find(item => item.kind === "todos" && item.entityId === id)
    const mutation: PendingMutation = {
      id: crypto.randomUUID(),
      kind: "todos",
      entityId: id,
      action: "purge",
      record: null,
      baseRevision: prior?.baseRevision ?? versionsRef.current.todos[id] ?? 0,
      queuedAt: Date.now()
    }
    const nextQueue = queueRef.current.filter(item => item.kind !== "todos" || item.entityId !== id)
    nextQueue.push(mutation)
    const nextRecords = { ...recordsRef.current, todos: recordsRef.current.todos.filter(item => item.id !== id) }
    try {
      persistOutbox(workspaceId, nextQueue)
      persistCache(workspaceId, {
        records: nextRecords,
        versions: versionsRef.current,
        conflicts: readCache(workspaceId).conflicts,
        lastSyncedAt: lastSyncedAtRef.current
      })
      queueRef.current = nextQueue
      recordsRef.current = nextRecords
      setRecords(nextRecords)
      setPendingCount(nextQueue.length)
      setStatus(navigator.onLine ? "syncing" : "offline")
      setErrorMessage(null)
      if (navigator.onLine) void flushQueue()
    } catch {
      setErrorMessage("削除をこの端末に保存できませんでした。空き容量を確認してください。")
      setStatus("error")
    }
  }, [workspaceId, isActive, flushQueue])
  const updateCategories = useCallback((updater: RecordUpdater<TodoCategory>) => {
    const previous = recordsRef.current.categories
    const next = applyUpdater(previous, updater)
    enqueueChanges("categories", previous, next)
  }, [enqueueChanges])
  const updateEvents = useCallback((updater: RecordUpdater<CalendarEvent>) => {
    const previous = recordsRef.current.events
    const next = applyUpdater(previous, updater)
    enqueueChanges("events", previous, next)
  }, [enqueueChanges])

  const startSync = useCallback(async (importLocalData: boolean, localData: WorkspaceRecords) => {
    if (!workspaceReady || !workspaceId || !uid || !scope) throw new Error("Googleログイン後に共有スペースへ参加してください。")
    setStatus("syncing")
    setErrorMessage(null)
    try {
      const service = await loadService()
      const key = installIdKey(workspaceId, uid)
      let installId = localStorage.getItem(key)
      if (!installId) {
        installId = crypto.randomUUID()
        localStorage.setItem(key, installId)
      }
      const result = await service.initializeWorkspaceData(workspaceId, uid, installId, importLocalData, localData)
      const snapshot = toWorkspaceRecords(result.snapshot)
      queueRef.current = readOutbox(workspaceId)
      persistOutbox(workspaceId, queueRef.current)
      setPendingCount(queueRef.current.length)
      const syncedAt = Date.now()
      persistCache(workspaceId, { records: snapshot.records, versions: snapshot.versions, conflicts: snapshot.conflicts, lastSyncedAt: syncedAt })
      if (result.importedLocalData) localStorage.setItem(importedKey(workspaceId), "done")
      else localStorage.removeItem(importedKey(workspaceId))
      localStorage.setItem(activeKey(workspaceId), "active")
      activeScopeRef.current = scope
      setSnapshot({ ...snapshot, fromCache: false }, false)
      setActiveScope(scope)
      setLastSyncedAt(syncedAt)
      lastSyncedAtRef.current = syncedAt
      setLocalDataImported(result.importedLocalData)
      setStatus("loading")
    } catch (error) {
      setErrorMessage(formatError(error))
      setStatus(navigator.onLine ? "error" : "offline")
      throw error
    }
  }, [workspaceReady, workspaceId, uid, scope, loadService, setSnapshot])

  const importLocalData = useCallback(async (localData: WorkspaceRecords) => {
    if (!isActive || !workspaceId || !uid) throw new Error("先にこの共有スペースで同期を開始してください。")
    setStatus("syncing")
    setErrorMessage(null)
    try {
      const service = await loadService()
      const key = installIdKey(workspaceId, uid)
      let installId = localStorage.getItem(key)
      if (!installId) {
        installId = crypto.randomUUID()
        localStorage.setItem(key, installId)
      }
      const result = await service.initializeWorkspaceData(workspaceId, uid, installId, true, localData)
      localStorage.setItem(importedKey(workspaceId), "done")
      setLocalDataImported(result.importedLocalData)
      setSnapshot(result.snapshot)
      await flushQueue()
    } catch (error) {
      setErrorMessage(formatError(error))
      setStatus(navigator.onLine ? "error" : "offline")
      throw error
    }
  }, [isActive, workspaceId, uid, loadService, setSnapshot, flushQueue])

  const retrySync = useCallback(async () => {
    if (!workspaceId || !isActive) return
    try {
      setStatus(queueRef.current.length ? "syncing" : "loading")
      setErrorMessage(null)
      const service = await loadService()
      const snapshot = await service.getWorkspaceData(workspaceId)
      setSnapshot(snapshot)
      if (snapshot.conflicts.length === 0) setStatus(queueRef.current.length ? "syncing" : snapshot.fromCache ? "offline" : "synced")
      await flushQueue()
    } catch (error) {
      setErrorMessage(formatError(error))
      setStatus(navigator.onLine ? "error" : "offline")
    }
  }, [workspaceId, isActive, loadService, setSnapshot, flushQueue])

  const resolveConflict = useCallback(async (id: string, choice: "local" | "remote") => {
    if (!workspaceId || !uid || !isActive) return
    try {
      const service = await loadService()
      await service.resolveWorkspaceConflict(workspaceId, uid, id, choice)
      await retrySync()
      const latest = await service.getWorkspaceData(workspaceId)
      if (latest.conflicts.some(conflict => conflict.id === id)) {
        setErrorMessage("共有側の内容が更新されました。最新の内容を確認して、もう一度選んでください。")
      }
    } catch (error) {
      setErrorMessage(formatError(error))
      setStatus("error")
      throw error
    }
  }, [workspaceId, uid, isActive, loadService, retrySync])

  const value = useMemo<WorkspaceDataSyncValue>(() => ({
    status: workspaceReady && !isActive && status === "local" ? "setup-required" : status,
    isActive,
    pendingCount,
    localDataImported,
    conflicts,
    lastSyncedAt,
    errorMessage,
    todos: records.todos,
    categories: records.categories,
    events: records.events,
    startSync,
    importLocalData,
    updateTodos,
    permanentlyDeleteTodo,
    updateCategories,
    updateEvents,
    retrySync,
    resolveConflict
  }), [workspaceReady, isActive, status, pendingCount, localDataImported, conflicts, lastSyncedAt, errorMessage, records, startSync, importLocalData, updateTodos, permanentlyDeleteTodo, updateCategories, updateEvents, retrySync, resolveConflict])

  return <WorkspaceDataSyncContext.Provider value={value}>{children}</WorkspaceDataSyncContext.Provider>
}
