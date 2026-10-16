import { createContext, useContext, type SetStateAction } from "react"
import type { CalendarEvent, Task, TodoCategory } from "@/app/mock-data"
import { DEFAULT_TODO_CATEGORIES } from "@/features/todos/todo-category-defaults"
import type { WorkspaceRecords, WorkspaceSyncConflict } from "@/features/workspace/firebase-workspace-data"

export type DataSyncStatus = "local" | "setup-required" | "loading" | "synced" | "syncing" | "offline" | "error"
type RecordUpdater<T> = SetStateAction<T[]>

export type WorkspaceDataSyncValue = {
  status: DataSyncStatus
  isActive: boolean
  pendingCount: number
  localDataImported: boolean
  conflicts: WorkspaceSyncConflict[]
  lastSyncedAt: number | null
  errorMessage: string | null
  todos: Task[]
  categories: TodoCategory[]
  events: CalendarEvent[]
  startSync: (importLocalData: boolean, localData: WorkspaceRecords) => Promise<void>
  importLocalData: (localData: WorkspaceRecords) => Promise<void>
  updateTodos: (updater: RecordUpdater<Task>) => void
  permanentlyDeleteTodo: (id: string) => void
  updateCategories: (updater: RecordUpdater<TodoCategory>) => void
  updateEvents: (updater: RecordUpdater<CalendarEvent>) => void
  retrySync: () => Promise<void>
  resolveConflict: (id: string, choice: "local" | "remote") => Promise<void>
}

const emptyRecords: WorkspaceRecords = { todos: [], categories: DEFAULT_TODO_CATEGORIES, events: [] }
const inactiveValue: WorkspaceDataSyncValue = {
  status: "local",
  isActive: false,
  pendingCount: 0,
  localDataImported: false,
  conflicts: [],
  lastSyncedAt: null,
  errorMessage: null,
  todos: emptyRecords.todos,
  categories: emptyRecords.categories,
  events: emptyRecords.events,
  startSync: async () => { throw new Error("共有スペースに接続していません。") },
  importLocalData: async () => { throw new Error("共有スペースに接続していません。") },
  updateTodos: () => undefined,
  permanentlyDeleteTodo: () => undefined,
  updateCategories: () => undefined,
  updateEvents: () => undefined,
  retrySync: async () => undefined,
  resolveConflict: async () => undefined
}

export const WorkspaceDataSyncContext = createContext<WorkspaceDataSyncValue>(inactiveValue)

export function useWorkspaceDataSync() {
  return useContext(WorkspaceDataSyncContext)
}
