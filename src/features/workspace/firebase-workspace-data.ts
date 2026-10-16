import { getApp, getApps, initializeApp } from "firebase/app"
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type Unsubscribe
} from "firebase/firestore"
import type { CalendarEvent, Task, TodoCategory } from "@/app/mock-data"
import { isLegacyDemoRecord, isLegacyDemoWorkspaceRecord, removeLegacyDemoEvents, removeLegacyDemoTasks } from "@/features/data/legacy-demo-data"
import { DEFAULT_TODO_CATEGORIES } from "@/features/todos/todo-category-defaults"
import { getFirebaseConfig } from "@/features/workspace/firebase-env"

export type WorkspaceRecords = {
  todos: Task[]
  categories: TodoCategory[]
  events: CalendarEvent[]
}

export type WorkspaceVersions = {
  todos: Record<string, number>
  categories: Record<string, number>
  events: Record<string, number>
}

export type WorkspaceRecordKind = keyof WorkspaceVersions
export type WorkspaceRecord = Task | TodoCategory | CalendarEvent

export type WorkspaceMutation = {
  id: string
  kind: WorkspaceRecordKind
  entityId: string
  action: "upsert" | "delete" | "purge"
  record: WorkspaceRecord | null
  sortOrder?: number
  baseRevision: number
  queuedAt: number
}

export type WorkspaceSyncConflict = {
  id: string
  kind: WorkspaceRecordKind
  entityId: string
  entityName: string
  localAction: "upsert" | "delete" | "purge"
  localRecord: WorkspaceRecord | null
  remoteRecord: WorkspaceRecord | null
  localSortOrder?: number
  remoteSortOrder?: number
  baseRevision: number
  remoteRevision: number
  createdByUid: string
  createdAt: number
}

export type WorkspaceDataSnapshot = {
  records: WorkspaceRecords
  versions: WorkspaceVersions
  conflicts: WorkspaceSyncConflict[]
  fromCache: boolean
}

const collectionNames: Record<WorkspaceRecordKind, string> = {
  todos: "todos",
  categories: "todoCategories",
  events: "calendarEvents"
}
const todoPurgeMarkerCollection = "todoPurgeMarkers"

const categoryTones = new Set(["peach", "green", "lavender", "blue", "mint", "yellow", "rose", "neutral", "life", "outing", "couple"])
const todoByValues = new Set(["A", "B"])
const eventByValues = new Set(["A", "B", "both"])
const calendarCategories = new Set(["暮らし", "おでかけ", "ふたり", "その他"])
const datePattern = /^\d{4}-\d{2}-\d{2}$/
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

function optionalTextWithin(value: unknown, maxLength: number) {
  return value === undefined || (typeof value === "string" && value.length <= maxLength)
}

export function workspaceRecordName(record: WorkspaceRecord | null) {
  if (!record) return "項目"
  if ("title" in record) return record.title
  return record.name
}

function canonicalRecord(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalRecord).join(",")}]`
  if (isRecord(value)) {
    return `{${Object.keys(value).filter(key => value[key] !== undefined).sort()
      .map(key => `${JSON.stringify(key)}:${canonicalRecord(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}

function getDb() {
  const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig())
  return getFirestore(app)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function withoutUndefined<T extends WorkspaceRecord>(record: T): T {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined)) as T
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value)) return false
  return typeof value.id === "string" && typeof value.title === "string" &&
    value.title.length > 0 && value.title.length <= 2000 &&
    typeof value.category === "string" && value.category.length > 0 && value.category.length <= 80 &&
    typeof value.done === "boolean" && todoByValues.has(String(value.by)) &&
    (value.dueDate === undefined || (typeof value.dueDate === "string" && datePattern.test(value.dueDate))) &&
    optionalTextWithin(value.memo, 10000) && optionalTextWithin(value.url, 2000) && optionalTextWithin(value.address, 2000)
}

function isTodoCategory(value: unknown): value is TodoCategory {
  return isRecord(value) && typeof value.id === "string" && typeof value.name === "string" &&
    value.name.trim().length > 0 && value.name.length <= 80 &&
    typeof value.tone === "string" && categoryTones.has(value.tone)
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (!isRecord(value)) return false
  return typeof value.id === "string" && typeof value.title === "string" &&
    value.title.length > 0 && value.title.length <= 2000 &&
    typeof value.date === "string" && datePattern.test(value.date) &&
    typeof value.category === "string" && calendarCategories.has(value.category) &&
    eventByValues.has(String(value.by)) &&
    (value.time === undefined || (typeof value.time === "string" && timePattern.test(value.time))) &&
    (value.endTime === undefined || (typeof value.endTime === "string" && timePattern.test(value.endTime))) &&
    optionalTextWithin(value.memo, 10000) && optionalTextWithin(value.address, 2000)
}

function parseTimestamp(value: unknown) {
  return value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function"
    ? value.toMillis() as number
    : 0
}

function parseConflict(id: string, data: DocumentData): WorkspaceSyncConflict | null {
  if (data.status !== "unresolved" ||
    (data.kind !== "todos" && data.kind !== "categories" && data.kind !== "events") ||
    typeof data.entityId !== "string" || (data.localAction !== "upsert" && data.localAction !== "delete" && data.localAction !== "purge")) return null
  const validLocal = (data.localAction === "delete" || data.localAction === "purge") && data.localRecord === null ||
    (data.kind === "todos" ? isTask(data.localRecord) : data.kind === "events" ? isCalendarEvent(data.localRecord) : isTodoCategory(data.localRecord))
  if (data.remoteAction !== "delete" && data.remoteAction !== "upsert") return null
  const validRemote = data.remoteAction === "delete"
    ? data.remoteRecord === null
    : data.kind === "todos" ? isTask(data.remoteRecord)
      : data.kind === "events" ? isCalendarEvent(data.remoteRecord)
        : isTodoCategory(data.remoteRecord)
  if (!validLocal || !validRemote) return null
  return {
    id,
    kind: data.kind,
    entityId: data.entityId,
    entityName: typeof data.entityName === "string" ? data.entityName : "項目",
    localAction: data.localAction,
    localRecord: data.localRecord === null ? null : data.localRecord as WorkspaceRecord,
    remoteRecord: data.remoteAction === "delete" || data.remoteRecord === null ? null : data.remoteRecord as WorkspaceRecord,
    localSortOrder: typeof data.localSortOrder === "number" ? data.localSortOrder : undefined,
    remoteSortOrder: typeof data.remoteSortOrder === "number" ? data.remoteSortOrder : undefined,
    baseRevision: Number(data.baseRevision) || 0,
    remoteRevision: Number(data.remoteRevision) || 0,
    createdByUid: typeof data.createdByUid === "string" ? data.createdByUid : "",
    createdAt: parseTimestamp(data.createdAt)
  }
}

function parseRecords(kind: WorkspaceRecordKind, docs: Array<{ id: string; data: () => DocumentData }>, versions: Record<string, number>) {
  const result: Array<{ record: WorkspaceRecord; order: number }> = []
  for (const snapshot of docs) {
    const data = snapshot.data()
    const revision = Number(data.revision)
    if (!Number.isInteger(revision) || revision < 1) continue
    versions[snapshot.id] = Math.max(versions[snapshot.id] ?? 0, revision)
    if (data.deleted === true || !isRecord(data.record)) continue
    const record = { ...data.record, id: snapshot.id }
    const sourceRecordId = typeof data.sourceRecordId === "string" ? data.sourceRecordId : data.record.id
    if ((kind === "todos" || kind === "events") && (
      isLegacyDemoRecord(kind, { id: sourceRecordId, title: data.record.title }) ||
      isLegacyDemoWorkspaceRecord(kind, { id: snapshot.id, title: data.record.title })
    )) continue
    if ((kind === "todos" && isTask(record)) || (kind === "events" && isCalendarEvent(record))) result.push({
      record: record as Task | CalendarEvent,
      order: typeof data.sortOrder === "number" ? data.sortOrder : result.length
    })
    if (kind === "categories" && isTodoCategory(record)) result.push({
      record,
      order: typeof data.sortOrder === "number" ? data.sortOrder : result.length
    })
  }
  result.sort((left, right) => {
    const byOrder = kind === "categories" ? left.order - right.order : right.order - left.order
    return byOrder || left.record.id.localeCompare(right.record.id)
  })
  return result.map(item => item.record)
}

async function readSnapshot(workspaceId: string): Promise<WorkspaceDataSnapshot> {
  const db = getDb()
  const workspaceRef = doc(db, "workspaces", workspaceId)
  const [todoSnapshot, categorySnapshot, eventSnapshot, conflictSnapshot, purgeMarkerSnapshot] = await Promise.all([
    getDocs(collection(workspaceRef, collectionNames.todos)),
    getDocs(collection(workspaceRef, collectionNames.categories)),
    getDocs(collection(workspaceRef, collectionNames.events)),
    getDocs(collection(workspaceRef, "syncConflicts")),
    getDocs(collection(workspaceRef, todoPurgeMarkerCollection))
  ])
  const versions: WorkspaceVersions = { todos: {}, categories: {}, events: {} }
  const todos = parseRecords("todos", todoSnapshot.docs, versions.todos) as Task[]
  for (const marker of purgeMarkerSnapshot.docs) {
    const revision = Number(marker.data().revision)
    if (Number.isInteger(revision) && revision > 0) versions.todos[marker.id] = Math.max(versions.todos[marker.id] ?? 0, revision)
  }
  const categories = parseRecords("categories", categorySnapshot.docs, versions.categories) as TodoCategory[]
  const events = parseRecords("events", eventSnapshot.docs, versions.events) as CalendarEvent[]
  const conflicts = conflictSnapshot.docs
    .map(snapshot => parseConflict(snapshot.id, snapshot.data()))
    .filter((conflict): conflict is WorkspaceSyncConflict => conflict !== null)
  return {
    records: { todos, categories: categories.length ? categories : DEFAULT_TODO_CATEGORIES, events },
    versions,
    conflicts,
    fromCache: todoSnapshot.metadata.fromCache || categorySnapshot.metadata.fromCache || eventSnapshot.metadata.fromCache || conflictSnapshot.metadata.fromCache || purgeMarkerSnapshot.metadata.fromCache
  }
}

export function getWorkspaceData(workspaceId: string) {
  return readSnapshot(workspaceId)
}

export function observeWorkspaceData(
  workspaceId: string,
  onNext: (snapshot: WorkspaceDataSnapshot) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const db = getDb()
  const workspaceRef = doc(db, "workspaces", workspaceId)
  let todos: Array<{ id: string; data: () => DocumentData }> | null = null
  let categories: Array<{ id: string; data: () => DocumentData }> | null = null
  let events: Array<{ id: string; data: () => DocumentData }> | null = null
  let conflicts: WorkspaceSyncConflict[] | null = null
  let purgeMarkers: Array<{ id: string; data: () => DocumentData }> | null = null
  const cacheState = { todos: true, categories: true, events: true, conflicts: true, purgeMarkers: true }

  const emit = () => {
    if (!todos || !categories || !events || !conflicts || !purgeMarkers) return
    const versions: WorkspaceVersions = { todos: {}, categories: {}, events: {} }
    const nextTodos = parseRecords("todos", todos, versions.todos) as Task[]
    for (const marker of purgeMarkers) {
      const revision = Number(marker.data().revision)
      if (Number.isInteger(revision) && revision > 0) versions.todos[marker.id] = Math.max(versions.todos[marker.id] ?? 0, revision)
    }
    const nextCategories = parseRecords("categories", categories, versions.categories) as TodoCategory[]
    const nextEvents = parseRecords("events", events, versions.events) as CalendarEvent[]
    onNext({
      records: { todos: nextTodos, categories: nextCategories.length ? nextCategories : DEFAULT_TODO_CATEGORIES, events: nextEvents },
      versions,
      conflicts,
      fromCache: Object.values(cacheState).some(Boolean)
    })
  }
  const options = { includeMetadataChanges: true }
  const unsubscribe = [
    onSnapshot(collection(workspaceRef, collectionNames.todos), options, snapshot => {
      todos = snapshot.docs
      cacheState.todos = snapshot.metadata.fromCache
      emit()
    }, onError),
    onSnapshot(collection(workspaceRef, collectionNames.categories), options, snapshot => {
      categories = snapshot.docs
      cacheState.categories = snapshot.metadata.fromCache
      emit()
    }, onError),
    onSnapshot(collection(workspaceRef, collectionNames.events), options, snapshot => {
      events = snapshot.docs
      cacheState.events = snapshot.metadata.fromCache
      emit()
    }, onError),
    onSnapshot(collection(workspaceRef, "syncConflicts"), options, snapshot => {
      conflicts = snapshot.docs
        .map(item => parseConflict(item.id, item.data()))
        .filter((conflict): conflict is WorkspaceSyncConflict => conflict !== null)
      cacheState.conflicts = snapshot.metadata.fromCache
      emit()
    }, onError),
    onSnapshot(collection(workspaceRef, todoPurgeMarkerCollection), options, snapshot => {
      purgeMarkers = snapshot.docs
      cacheState.purgeMarkers = snapshot.metadata.fromCache
      emit()
    }, onError)
  ]
  return () => unsubscribe.forEach(stop => stop())
}

export async function removeLegacyDemoDataFromWorkspace(workspaceId: string, uid: string) {
  const workspaceRef = doc(getDb(), "workspaces", workspaceId)
  const [todos, events] = await Promise.all([
    getDocs(collection(workspaceRef, collectionNames.todos)),
    getDocs(collection(workspaceRef, collectionNames.events))
  ])
  if (todos.metadata.fromCache || events.metadata.fromCache) return false

  const candidates = [
    ...todos.docs.flatMap(snapshot => {
      const data = snapshot.data()
      if (data.deleted === true || !isRecord(data.record)) return []
      const sourceRecordId = typeof data.sourceRecordId === "string" ? data.sourceRecordId : data.record.id
      return isLegacyDemoRecord("todos", { id: sourceRecordId, title: data.record.title }) ||
        isLegacyDemoWorkspaceRecord("todos", { id: snapshot.id, title: data.record.title })
        ? [{ kind: "todos" as const, id: snapshot.id }]
        : []
    }),
    ...events.docs.flatMap(snapshot => {
      const data = snapshot.data()
      if (data.deleted === true || !isRecord(data.record)) return []
      const sourceRecordId = typeof data.sourceRecordId === "string" ? data.sourceRecordId : data.record.id
      return isLegacyDemoRecord("events", { id: sourceRecordId, title: data.record.title }) ||
        isLegacyDemoWorkspaceRecord("events", { id: snapshot.id, title: data.record.title })
        ? [{ kind: "events" as const, id: snapshot.id }]
        : []
    })
  ]

  await withConcurrency(candidates, 4, async candidate => {
    const reference = recordReference(workspaceId, candidate.kind, candidate.id)
    await runTransaction(getDb(), async transaction => {
      const snapshot = await transaction.get(reference)
      if (!snapshot.exists()) return
      const current = snapshot.data()
      if (current.deleted === true || !isRecord(current.record)) return
      const sourceRecordId = typeof current.sourceRecordId === "string" ? current.sourceRecordId : current.record.id
      if (!isLegacyDemoRecord(candidate.kind, { id: sourceRecordId, title: current.record.title }) &&
        !isLegacyDemoWorkspaceRecord(candidate.kind, { id: candidate.id, title: current.record.title })) return
      const revision = Number(current.revision)
      if (!Number.isInteger(revision) || revision < 1 || revision >= 2147483647) return
      transaction.update(reference, {
        revision: revision + 1,
        deleted: true,
        updatedAt: serverTimestamp(),
        updatedByUid: uid
      })
    })
  })
  return true
}

function recordReference(workspaceId: string, kind: WorkspaceRecordKind, id: string) {
  return doc(getDb(), "workspaces", workspaceId, collectionNames[kind], id)
}

export async function applyWorkspaceMutation(workspaceId: string, uid: string, mutation: WorkspaceMutation) {
  const validRecord = mutation.kind === "todos" ? isTask(mutation.record)
    : mutation.kind === "categories" ? isTodoCategory(mutation.record)
      : mutation.kind === "events" ? isCalendarEvent(mutation.record) : false
  if (!uid || !["todos", "categories", "events"].includes(mutation.kind) ||
    !mutation.id || mutation.id.includes("/") || !mutation.entityId || mutation.entityId.includes("/") ||
    !Number.isInteger(mutation.baseRevision) || mutation.baseRevision < 0 ||
    (mutation.action !== "upsert" && mutation.action !== "delete" && mutation.action !== "purge") ||
    (mutation.action === "purge" && mutation.kind !== "todos") ||
    (mutation.action === "upsert" && !validRecord) ||
    (mutation.action === "delete" && mutation.record !== null && !validRecord) ||
    (mutation.action === "purge" && mutation.record !== null)) {
    throw new Error("同期する変更の内容を確認できませんでした。")
  }
  const db = getDb()
  const recordRef = doc(db, "workspaces", workspaceId, collectionNames[mutation.kind], mutation.entityId)
  const purgeMarkerRef = doc(db, "workspaces", workspaceId, todoPurgeMarkerCollection, mutation.entityId)
  const conflictRef = doc(db, "workspaces", workspaceId, "syncConflicts", mutation.id)
  return runTransaction(db, async transaction => {
    const [currentSnapshot, conflictSnapshot, purgeMarkerSnapshot] = await Promise.all([
      transaction.get(recordRef), transaction.get(conflictRef),
      mutation.kind === "todos" ? transaction.get(purgeMarkerRef) : Promise.resolve(null)
    ])
    const current = currentSnapshot.exists() ? currentSnapshot.data() : null
    const purgeMarker = purgeMarkerSnapshot?.exists() ? purgeMarkerSnapshot.data() : null
    const currentRevision = Math.max(Number(current?.revision) || 0, Number(purgeMarker?.revision) || 0)
    if (current?.lastMutationId === mutation.id || purgeMarker?.lastMutationId === mutation.id) return { status: "saved" as const, revision: currentRevision }
    if (currentRevision !== mutation.baseRevision) {
      if (!conflictSnapshot.exists()) {
        const remoteRecord: WorkspaceRecord | null = current && current.deleted !== true && isRecord(current.record)
          ? { ...current.record, id: mutation.entityId } as WorkspaceRecord : null
        const localRecord: WorkspaceRecord | null = mutation.record
          ? withoutUndefined({ ...mutation.record, id: mutation.entityId } as WorkspaceRecord) : null
        transaction.set(conflictRef, {
          kind: mutation.kind,
          entityId: mutation.entityId,
          entityName: workspaceRecordName(localRecord || remoteRecord),
          localAction: mutation.action,
          localRecord: mutation.action === "purge" ? null : localRecord,
          remoteAction: current?.deleted === true || !remoteRecord ? "delete" : "upsert",
          remoteRecord: current?.deleted === true ? null : remoteRecord,
          localSortOrder: mutation.sortOrder ?? null,
          remoteSortOrder: typeof current?.sortOrder === "number" ? current.sortOrder : null,
          baseRevision: mutation.baseRevision,
          remoteRevision: currentRevision,
          createdByUid: uid,
          createdAt: serverTimestamp(),
          status: "unresolved"
        })
      }
      return { status: "conflict" as const, revision: currentRevision }
    }

    if (mutation.action === "purge") {
      if (current && (current.deleted === true || !isTask(current.record) || !current.record.done)) {
        throw new Error("完了済みのTODOだけ削除できます。最新の一覧を読み込んで再度お試しください。")
      }
      const nextRevision = currentRevision + 1
      if (currentSnapshot.exists()) transaction.delete(recordRef)
      transaction.set(purgeMarkerRef, {
        revision: nextRevision,
        updatedAt: serverTimestamp(),
        updatedByUid: uid,
        lastMutationId: mutation.id
      })
      return { status: "saved" as const, revision: nextRevision }
    }
    if (mutation.action === "delete" && !currentSnapshot.exists()) return { status: "saved" as const, revision: currentRevision }
    const currentRecord = isRecord(current?.record) ? current.record : null
    const nextRecord = mutation.action === "delete"
      ? currentRecord
      : mutation.record ? withoutUndefined({ ...mutation.record, id: mutation.entityId } as WorkspaceRecord) : null
    if (!nextRecord) throw new Error("同期するデータを読み取れませんでした。")
    const nextRevision = currentRevision + 1
    transaction.set(recordRef, {
      record: nextRecord,
      revision: nextRevision,
      deleted: mutation.action === "delete",
      sortOrder: mutation.action === "delete"
        ? current?.sortOrder ?? 0
        : mutation.sortOrder ?? current?.sortOrder ?? Date.now(),
      createdAt: current?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
      lastMutationId: mutation.id,
      ...(typeof current?.sourceInstallId === "string" ? { sourceInstallId: current.sourceInstallId } : {}),
      ...(typeof current?.sourceRecordId === "string" ? { sourceRecordId: current.sourceRecordId } : {})
    })
    return { status: "saved" as const, revision: nextRevision }
  })
}

export async function mergeWorkspaceConflictLocalChange(
  workspaceId: string,
  uid: string,
  conflictId: string,
  mutation: WorkspaceMutation
) {
  const validRecord = mutation.kind === "todos" ? mutation.record === null || isTask(mutation.record)
    : mutation.kind === "categories" ? mutation.record === null || isTodoCategory(mutation.record)
      : mutation.kind === "events" ? mutation.record === null || isCalendarEvent(mutation.record) : false
  if (!uid || !validRecord || (mutation.action !== "upsert" && mutation.action !== "delete" && mutation.action !== "purge") ||
    (mutation.action === "purge" && (mutation.kind !== "todos" || mutation.record !== null))) {
    throw new Error("競合している変更を確認できませんでした。")
  }
  const db = getDb()
  const conflictRef = doc(db, "workspaces", workspaceId, "syncConflicts", conflictId)
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(conflictRef)
    if (!snapshot.exists()) return false
    const conflict = snapshot.data()
    if (conflict.status !== "unresolved" || conflict.createdByUid !== uid ||
      conflict.kind !== mutation.kind || conflict.entityId !== mutation.entityId) return false
    const localRecord: WorkspaceRecord | null = mutation.record
      ? withoutUndefined({ ...mutation.record, id: mutation.entityId } as WorkspaceRecord) : null
    transaction.update(conflictRef, {
      entityName: workspaceRecordName(localRecord ?? conflict.remoteRecord ?? null),
      localAction: mutation.action,
      localRecord: mutation.action === "purge" ? null : localRecord,
      localSortOrder: mutation.sortOrder ?? null,
      localUpdatedByUid: uid
    })
    return true
  })
}

function importedRecordId(kind: WorkspaceRecordKind, sourceId: string) {
  // Stable across devices: shared demo IDs and records copied from a backup are imported once.
  return hashId(`${kind}:${sourceId}`).then(hash => `legacy_${kind}_${hash}`)
}

async function hashId(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}

async function withConcurrency<T>(items: T[], concurrency: number, run: (item: T, index: number) => Promise<void>) {
  let next = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      await run(items[index], index)
    }
  })
  await Promise.all(workers)
}

async function createImportedRecord<T extends WorkspaceRecord>(
  workspaceId: string,
  uid: string,
  installId: string,
  kind: WorkspaceRecordKind,
  source: T,
  sortOrder?: number
) {
  const id = kind === "categories"
    ? `imported_category_${await hashId((source as TodoCategory).name.trim().normalize("NFKC"))}`
    : await importedRecordId(kind, source.id)
  const ref = recordReference(workspaceId, kind, id)
  const purgeMarkerRef = doc(getDb(), "workspaces", workspaceId, todoPurgeMarkerCollection, id)
  await runTransaction(getDb(), async transaction => {
    const [snapshot, purgeMarkerSnapshot] = await Promise.all([
      transaction.get(ref),
      kind === "todos" ? transaction.get(purgeMarkerRef) : Promise.resolve(null)
    ])
    if (snapshot.exists()) {
      const current = snapshot.data()
      const currentRecord = isRecord(current.record) ? { ...current.record, id } as WorkspaceRecord : null
      if (!currentRecord) throw new Error("共有データに読み取れない項目があります。サポートへ連絡してください。")
      const importedRecord = withoutUndefined({ ...source, id } as WorkspaceRecord)
      const sameData = canonicalRecord(currentRecord) === canonicalRecord(importedRecord)
      if (!sameData || current.deleted === true) {
        const conflictId = `migration_${await hashId(`${installId}:${kind}:${source.id}:${Number(current.revision) || 0}:${canonicalRecord(importedRecord)}`)}`
        const conflictRef = doc(getDb(), "workspaces", workspaceId, "syncConflicts", conflictId)
        const conflictSnapshot = await transaction.get(conflictRef)
        if (!conflictSnapshot.exists()) {
          transaction.set(conflictRef, {
            kind,
            entityId: id,
            entityName: workspaceRecordName(importedRecord),
            localAction: "upsert",
            localRecord: importedRecord,
            remoteAction: current.deleted === true ? "delete" : "upsert",
            remoteRecord: current.deleted === true ? null : currentRecord,
            localSortOrder: sortOrder ?? null,
            remoteSortOrder: typeof current.sortOrder === "number" ? current.sortOrder : null,
            baseRevision: 0,
            remoteRevision: Number(current.revision) || 0,
            createdByUid: uid,
            createdAt: serverTimestamp(),
            status: "unresolved"
          })
        }
      }
      return
    }
    if (kind === "todos" && purgeMarkerSnapshot?.exists()) {
      const markerRevision = Number(purgeMarkerSnapshot.data().revision) || 0
      const importedRecord = withoutUndefined({ ...source, id } as WorkspaceRecord)
      const conflictId = `migration_${await hashId(`${installId}:${kind}:${source.id}:${markerRevision}:${canonicalRecord(importedRecord)}`)}`
      const conflictRef = doc(getDb(), "workspaces", workspaceId, "syncConflicts", conflictId)
      const conflictSnapshot = await transaction.get(conflictRef)
      if (!conflictSnapshot.exists()) {
        transaction.set(conflictRef, {
          kind,
          entityId: id,
          entityName: workspaceRecordName(importedRecord),
          localAction: "upsert",
          localRecord: importedRecord,
          remoteAction: "delete",
          remoteRecord: null,
          localSortOrder: sortOrder ?? null,
          remoteSortOrder: null,
          baseRevision: 0,
          remoteRevision: markerRevision,
          createdByUid: uid,
          createdAt: serverTimestamp(),
          status: "unresolved"
        })
      }
      return
    }
    transaction.set(ref, {
      record: withoutUndefined({ ...source, id } as WorkspaceRecord),
      revision: 1,
      deleted: false,
      sortOrder: sortOrder ?? 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      updatedByUid: uid,
      sourceInstallId: installId,
      sourceRecordId: source.id
    })
  })
}

export async function initializeWorkspaceData(
  workspaceId: string,
  uid: string,
  installId: string,
  importLocalData: boolean,
  localData: WorkspaceRecords
): Promise<{ snapshot: WorkspaceDataSnapshot; importedLocalData: boolean }> {
  const db = getDb()
  await removeLegacyDemoDataFromWorkspace(workspaceId, uid)
  const deviceRef = doc(db, "workspaces", workspaceId, "syncDevices", installId)
  const existingDevice = await getDoc(deviceRef)
  let imported = existingDevice.data()?.importedLocalData === true

  if (importLocalData) {
    if (!Array.isArray(localData.todos) || !Array.isArray(localData.categories) || !Array.isArray(localData.events)) {
      throw new Error("この端末のデータを読み取れませんでした。バックアップを確認してください。")
    }
    const invalidTodos = localData.todos.filter(item => !isTask(item)).length
    const invalidCategories = localData.categories.filter(item => !isTodoCategory(item)).length
    const invalidEvents = localData.events.filter(item => !isCalendarEvent(item)).length
    if (invalidTodos || invalidCategories || invalidEvents) {
      throw new Error(`共有に追加できない項目があります（TODO ${invalidTodos}件・カテゴリ ${invalidCategories}件・予定 ${invalidEvents}件）。元データをJSONバックアップして確認してください。`)
    }
    const categoryNames = new Set<string>()
    const categories = localData.categories.filter(category => {
      const name = category.name.trim()
      if (!name || categoryNames.has(name)) return false
      categoryNames.add(name)
      return true
    })
    const todos = [...new Map(removeLegacyDemoTasks(localData.todos).map(task => [task.id, task])).values()]
    const events = [...new Map(removeLegacyDemoEvents(localData.events).map(event => [event.id, event])).values()]
    const categoryOffset = (await readSnapshot(workspaceId)).records.categories.length
    await withConcurrency(categories, 4, (category, index) => createImportedRecord(workspaceId, uid, installId, "categories", category, categoryOffset + index))
    const baseOrder = Date.now()
    await withConcurrency(todos, 4, (task, index) => createImportedRecord(workspaceId, uid, installId, "todos", task, baseOrder + todos.length - index))
    await withConcurrency(events, 4, (event, index) => createImportedRecord(workspaceId, uid, installId, "events", event, baseOrder + events.length - index))
    imported = true
  }

  const afterImport = await readSnapshot(workspaceId)
  if (Object.keys(afterImport.versions.categories).length === 0) {
    await withConcurrency(DEFAULT_TODO_CATEGORIES, 4, (category, index) => createImportedRecord(workspaceId, uid, installId, "categories", category, index))
  }

  await runTransaction(db, async transaction => {
    const current = await transaction.get(deviceRef)
    transaction.set(deviceRef, {
      uid,
      installId,
      importedLocalData: imported,
      activatedAt: current.data()?.activatedAt ?? serverTimestamp(),
      updatedAt: serverTimestamp()
    })
  })
  return { snapshot: await readSnapshot(workspaceId), importedLocalData: imported }
}

export async function resolveWorkspaceConflict(
  workspaceId: string,
  uid: string,
  conflictId: string,
  choice: "local" | "remote"
): Promise<"resolved" | "changed"> {
  const db = getDb()
  const conflictRef = doc(db, "workspaces", workspaceId, "syncConflicts", conflictId)
  return runTransaction(db, async transaction => {
    const conflictSnapshot = await transaction.get(conflictRef)
    if (!conflictSnapshot.exists()) throw new Error("競合データが見つかりません。")
    const conflict = conflictSnapshot.data()
    if (conflict.status !== "unresolved") return "resolved"
    if (conflict.kind !== "todos" && conflict.kind !== "categories" && conflict.kind !== "events") {
      throw new Error("競合データの種類を確認できませんでした。")
    }
    const kind = conflict.kind as WorkspaceRecordKind
    const recordRef = doc(db, "workspaces", workspaceId, collectionNames[kind], String(conflict.entityId))
    const recordSnapshot = await transaction.get(recordRef)
    const purgeMarkerRef = doc(db, "workspaces", workspaceId, todoPurgeMarkerCollection, String(conflict.entityId))
    const purgeMarkerSnapshot = kind === "todos" ? await transaction.get(purgeMarkerRef) : null
    const current = recordSnapshot.exists() ? recordSnapshot.data() : null
    const purgeMarker = purgeMarkerSnapshot?.exists() ? purgeMarkerSnapshot.data() : null
    const revision = Math.max(Number(current?.revision) || 0, Number(purgeMarker?.revision) || 0)
    if (revision !== Number(conflict.remoteRevision)) {
      const remoteRecord = current && current.deleted !== true && isRecord(current.record)
        ? { ...current.record, id: String(conflict.entityId) } as WorkspaceRecord
        : null
      transaction.update(conflictRef, {
        entityName: workspaceRecordName(remoteRecord ?? conflict.localRecord ?? null),
        remoteAction: remoteRecord ? "upsert" : "delete",
        remoteRecord,
        remoteSortOrder: typeof current?.sortOrder === "number" ? current.sortOrder : null,
        remoteRevision: revision,
        refreshedAt: serverTimestamp()
      })
      return "changed"
    }
    if (choice === "local") {
      if (conflict.localAction === "purge") {
        if (kind !== "todos") throw new Error("削除対象の種類を確認できませんでした。")
        if (recordSnapshot.exists()) transaction.delete(recordRef)
        transaction.set(purgeMarkerRef, {
          revision: revision + 1,
          updatedAt: serverTimestamp(),
          updatedByUid: uid,
          lastMutationId: "conflict_" + conflictId
        })
        transaction.update(conflictRef, {
          status: "resolved",
          resolution: choice,
          resolvedByUid: uid,
          resolvedAt: serverTimestamp()
        })
        return "resolved"
      }
      const record = conflict.localRecord ?? current?.record ?? conflict.remoteRecord
      if (!isRecord(record)) throw new Error("この変更を復元できませんでした。")
      transaction.set(recordRef, {
        record: withoutUndefined({ ...record, id: conflict.entityId } as WorkspaceRecord),
        revision: revision + 1,
        deleted: conflict.localAction === "delete",
        sortOrder: typeof conflict.localSortOrder === "number" ? conflict.localSortOrder : current?.sortOrder ?? 0,
        createdAt: current?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedByUid: uid,
        ...(typeof current?.sourceInstallId === "string" ? { sourceInstallId: current.sourceInstallId } : {}),
        ...(typeof current?.sourceRecordId === "string" ? { sourceRecordId: current.sourceRecordId } : {})
      })
    }
    transaction.update(conflictRef, {
      status: "resolved",
      resolution: choice,
      resolvedByUid: uid,
      resolvedAt: serverTimestamp()
    })
    return "resolved"
  })
}
