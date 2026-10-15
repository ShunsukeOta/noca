import type { CalendarEvent, Task, TodoCategory } from "@/app/mock-data"
import { isCalendarDate, CALENDAR_EVENT_STORAGE_KEY, CALENDAR_SAMPLE_MIGRATION_KEYS } from "@/features/calendar/calendar-store"
import { TODO_CATEGORY_STORAGE_KEY, TODO_STORAGE_KEY } from "@/features/todos/todo-store"

export const LOCAL_BACKUP_FORMAT = "noca.local-backup" as const
export const LOCAL_BACKUP_VERSION = 1 as const
export const MAX_LOCAL_BACKUP_SIZE_BYTES = 20 * 1024 * 1024

export type LocalBackup = {
  format: typeof LOCAL_BACKUP_FORMAT
  version: typeof LOCAL_BACKUP_VERSION
  exportedAt: string
  localState: {
    calendarSampleMigrations: {
      v2: boolean
      v3: boolean
    }
  }
  data: {
    todos: Task[]
    todoCategories: TodoCategory[]
    calendarEvents: CalendarEvent[]
  }
}

const validCategoryTones = new Set(["peach", "green", "lavender", "blue", "mint", "yellow", "rose", "neutral", "life", "outing", "couple"])
const calendarCategories = new Set(["暮らし", "おでかけ", "ふたり", "その他"])
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/
const legacyToneMap: Partial<Record<string, TodoCategory["tone"]>> = {
  outing: "peach",
  life: "green",
  couple: "lavender"
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseTask(value: unknown): Task | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
    typeof value.title !== "string" || !value.title.trim() ||
    typeof value.category !== "string" || !value.category.trim() ||
    typeof value.done !== "boolean" || (value.by !== "A" && value.by !== "B")) return null

  const task: Task = {
    id: value.id,
    title: value.title,
    category: value.category,
    done: value.done,
    by: value.by
  }
  for (const key of ["dueDate", "memo", "url", "address"] as const) {
    const field = value[key]
    if (field === undefined) continue
    if (typeof field !== "string" || (key === "dueDate" && !isCalendarDate(field))) return null
    task[key] = field
  }
  return task
}

function parseTodoCategory(value: unknown): TodoCategory | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
    typeof value.name !== "string" || !value.name.trim() || value.name.length > 80 ||
    typeof value.tone !== "string" || !validCategoryTones.has(value.tone)) return null
  return {
    id: value.id,
    name: value.name,
    tone: legacyToneMap[value.tone] ?? value.tone as TodoCategory["tone"]
  }
}

function parseCalendarEvent(value: unknown): CalendarEvent | null {
  if (!isRecord(value) || typeof value.id !== "string" || !value.id ||
    typeof value.title !== "string" || !value.title.trim() ||
    typeof value.date !== "string" || !isCalendarDate(value.date) ||
    typeof value.category !== "string" || !calendarCategories.has(value.category) ||
    (value.by !== "A" && value.by !== "B" && value.by !== "both")) return null

  const event: CalendarEvent = {
    id: value.id,
    title: value.title,
    date: value.date,
    category: value.category,
    by: value.by
  }
  for (const key of ["time", "endTime"] as const) {
    const field = value[key]
    if (field === undefined) continue
    if (typeof field !== "string" || !timePattern.test(field)) return null
    event[key] = field
  }
  for (const key of ["memo", "address"] as const) {
    const field = value[key]
    if (field === undefined) continue
    if (typeof field !== "string") return null
    event[key] = field
  }
  return event
}

function hasUniqueValues(values: string[]) {
  return new Set(values).size === values.length
}

export function parseLocalBackup(serialized: string): LocalBackup {
  let raw: unknown
  try {
    raw = JSON.parse(serialized)
  } catch {
    throw new Error("JSONファイルを読み取れません。")
  }
  if (!isRecord(raw) || raw.format !== LOCAL_BACKUP_FORMAT) {
    throw new Error("nocaのバックアップファイルではありません。")
  }
  if (raw.version !== LOCAL_BACKUP_VERSION) {
    throw new Error("このバックアップのバージョンには対応していません。")
  }
  if (typeof raw.exportedAt !== "string" || !Number.isFinite(Date.parse(raw.exportedAt)) ||
    !isRecord(raw.localState) || !isRecord(raw.localState.calendarSampleMigrations) ||
    typeof raw.localState.calendarSampleMigrations.v2 !== "boolean" ||
    typeof raw.localState.calendarSampleMigrations.v3 !== "boolean" ||
    !isRecord(raw.data) || !Array.isArray(raw.data.todos) ||
    !Array.isArray(raw.data.todoCategories) || raw.data.todoCategories.length === 0 ||
    !Array.isArray(raw.data.calendarEvents)) {
    throw new Error("バックアップの内容が正しくありません。")
  }

  const todos = raw.data.todos.map(parseTask)
  const todoCategories = raw.data.todoCategories.map(parseTodoCategory)
  const calendarEvents = raw.data.calendarEvents.map(parseCalendarEvent)
  if (todos.some(item => item === null) || todoCategories.some(item => item === null) || calendarEvents.some(item => item === null)) {
    throw new Error("TODO・カテゴリ・予定のいずれかに不正なデータがあります。")
  }
  const validTodos = todos as Task[]
  const validCategories = todoCategories as TodoCategory[]
  const validEvents = calendarEvents as CalendarEvent[]
  if (!hasUniqueValues(validTodos.map(item => item.id)) ||
    !hasUniqueValues(validCategories.map(item => item.id)) ||
    !hasUniqueValues(validCategories.map(item => item.name)) ||
    !hasUniqueValues(validEvents.map(item => item.id))) {
    throw new Error("バックアップ内に重複したIDまたはカテゴリ名があります。")
  }
  const categoryNames = new Set(validCategories.map(category => category.name))
  if (validTodos.some(todo => !categoryNames.has(todo.category))) {
    throw new Error("TODOで使われているカテゴリがカテゴリ一覧にありません。")
  }

  const migrations = raw.localState.calendarSampleMigrations as { v2: boolean; v3: boolean }
  const hasLegacySamples = validEvents.some(event => ["e1", "e2", "e3", "e4"].includes(event.id))
  const hasVersionedSamples = validEvents.some(event => event.id.startsWith("demo-"))
  const hasV3Samples = validEvents.some(event => event.id.startsWith("demo-v3-"))
  if (((hasLegacySamples || hasVersionedSamples) && migrations.v2 !== true) ||
    (hasV3Samples && migrations.v3 !== true)) {
    throw new Error("カレンダーのサンプル移行状態と予定データが一致しません。")
  }

  return {
    format: LOCAL_BACKUP_FORMAT,
    version: LOCAL_BACKUP_VERSION,
    exportedAt: raw.exportedAt,
    localState: {
      calendarSampleMigrations: { v2: migrations.v2, v3: migrations.v3 }
    },
    data: {
      todos: validTodos,
      todoCategories: validCategories,
      calendarEvents: validEvents
    }
  }
}

export function restoreLocalBackup(backup: LocalBackup) {
  const updates: Array<[string, string | null]> = [
    [TODO_STORAGE_KEY, JSON.stringify(backup.data.todos)],
    [TODO_CATEGORY_STORAGE_KEY, JSON.stringify(backup.data.todoCategories)],
    [CALENDAR_EVENT_STORAGE_KEY, JSON.stringify(backup.data.calendarEvents)],
    [CALENDAR_SAMPLE_MIGRATION_KEYS.v2, backup.localState.calendarSampleMigrations.v2 ? "done" : null],
    [CALENDAR_SAMPLE_MIGRATION_KEYS.v3, backup.localState.calendarSampleMigrations.v3 ? "done" : null]
  ]
  const previous = updates.map(([key]) => [key, localStorage.getItem(key)] as const)

  try {
    for (const [key, value] of updates) {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    }
  } catch {
    let rollbackFailed = false
    for (const [key, value] of previous.reverse()) {
      try {
        if (value === null) localStorage.removeItem(key)
        else localStorage.setItem(key, value)
      } catch {
        rollbackFailed = true
      }
    }
    throw new Error(rollbackFailed
      ? "保存に失敗し、元のデータを完全には戻せませんでした。ページを閉じずに再読み込みしてください。"
      : "保存に失敗したため、現在のデータを元に戻しました。空き容量を確認して再試行してください。")
  }
}

export function createLocalBackup(
  data: LocalBackup["data"],
  localState: LocalBackup["localState"],
  exportedAt = new Date().toISOString()
): LocalBackup {
  return {
    format: LOCAL_BACKUP_FORMAT,
    version: LOCAL_BACKUP_VERSION,
    exportedAt,
    localState,
    data: {
      todos: data.todos,
      todoCategories: data.todoCategories,
      calendarEvents: data.calendarEvents
    }
  }
}

export function localBackupFilename(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `noca-backup-${year}-${month}-${day}.json`
}
