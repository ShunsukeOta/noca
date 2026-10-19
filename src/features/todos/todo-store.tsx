import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type SetStateAction } from "react"
import { type Task, type TaskCategory, type TodoCategory } from "@/app/mock-data"
import { DEFAULT_TODO_CATEGORIES } from "@/features/todos/todo-category-defaults"
import { removeLegacyDemoTasks } from "@/features/data/legacy-demo-data"
import { useWorkspaceDataSync } from "@/features/workspace/workspace-data-sync-context"
import { useWorkspaceMembership } from "@/features/workspace/workspace-membership"

export const TODO_STORAGE_KEY = "noca.todos.v1"
export const TODO_CATEGORY_STORAGE_KEY = "noca.todo.categories.v1"
export { DEFAULT_TODO_CATEGORIES }
const validTones = new Set(["peach", "green", "lavender", "blue", "mint", "yellow", "rose", "neutral", "life", "outing", "couple"])
const legacyToneMap: Partial<Record<string, TodoCategory["tone"]>> = {
  outing: "peach",
  life: "green",
  couple: "lavender"
}

export type TodoDraft = {
  title: string
  category: TaskCategory
  dueDate?: string
  memo?: string
  url?: string
  address?: string
}

type DeletedTodo = { task: Task; index: number }
type TodoEditorTarget = { mode: "create" } | { mode: "edit"; id: string }

type TodoContextValue = {
  todos: Task[]
  categories: TodoCategory[]
  deviceTodos: Task[]
  deviceCategories: TodoCategory[]
  storageError: boolean
  editor: TodoEditorTarget | null
  deleted: DeletedTodo | null
  openCreate: () => void
  openEdit: (id: string) => void
  closeEditor: () => void
  addTodo: (draft: TodoDraft) => void
  updateTodo: (id: string, draft: TodoDraft) => void
  toggleTodo: (id: string) => void
  deleteTodo: (id: string) => void
  permanentlyDeleteTodo: (id: string) => void
  undoDelete: () => void
  dismissDeleted: () => void
  addCategory: (category: Omit<TodoCategory, "id">) => void
  updateCategory: (id: string, category: TodoCategory) => void
  updateCategoryTone: (id: string, tone: TodoCategory["tone"]) => void
  deleteCategory: (id: string, moveToId?: string) => void
  setCategoryOrder: (ids: string[]) => void
  restoreLocalData: (todos: Task[], categories: TodoCategory[]) => void
}

const TodoContext = createContext<TodoContextValue | null>(null)

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false
  const data = value as Partial<Task>
  return typeof data.id === "string" &&
    typeof data.title === "string" &&
    typeof data.category === "string" && data.category.length > 0 &&
    typeof data.done === "boolean" &&
    (data.by === "A" || data.by === "B") &&
    (data.dueDate === undefined || typeof data.dueDate === "string")
}

type StoredTodoCategory = Omit<TodoCategory, "id"> & { id?: string }

function isTodoCategory(value: unknown): value is StoredTodoCategory {
  if (!value || typeof value !== "object") return false
  const category = value as Partial<TodoCategory> & { id?: unknown }
  return typeof category.name === "string" && category.name.trim().length > 0 &&
    category.name.length <= 80 && (category.id === undefined || typeof category.id === "string") &&
    typeof category.tone === "string" && validTones.has(category.tone)
}

function loadCategories(): TodoCategory[] {
  try {
    const raw = localStorage.getItem(TODO_CATEGORY_STORAGE_KEY)
    if (raw === null) return DEFAULT_TODO_CATEGORIES
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isTodoCategory)) return DEFAULT_TODO_CATEGORIES
    const unique = parsed
      .filter((item, index, all) => all.findIndex(other => other.name === item.name) === index)
      .map(item => ({ ...item, id: item.id || crypto.randomUUID(), tone: legacyToneMap[item.tone] ?? item.tone }))
    return unique.length ? unique : DEFAULT_TODO_CATEGORIES
  } catch {
    return DEFAULT_TODO_CATEGORIES
  }
}

function loadTodos(): { records: Task[]; shouldPersist: boolean } {
  let raw: string | null
  try {
    raw = localStorage.getItem(TODO_STORAGE_KEY)
  } catch {
    return { records: [], shouldPersist: false }
  }
  if (raw === null) return { records: [], shouldPersist: true }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isTask)) return { records: [], shouldPersist: false }
    return { records: removeLegacyDemoTasks(parsed), shouldPersist: true }
  } catch {
    return { records: [], shouldPersist: false }
  }
}

export function TodoProvider({ children }: { children: ReactNode }) {
  const sharedData = useWorkspaceDataSync()
  const { authUser, members } = useWorkspaceMembership()
  const [initial] = useState(() => ({ todos: loadTodos(), categories: loadCategories() }))
  const [deviceTodos, setDeviceTodos] = useState<Task[]>(initial.todos.records)
  const [shouldPersistTodos, setShouldPersistTodos] = useState(initial.todos.shouldPersist)
  const [deviceCategories, setDeviceCategories] = useState<TodoCategory[]>(() => {
    const configured = initial.categories
    const missing = initial.todos.records.map(task => task.category).filter(name => !configured.some(category => category.name === name))
    return [...configured, ...[...new Set(missing)].map(name => ({ id: crypto.randomUUID(), name, tone: "neutral" as const }))]
  })
  const todos = sharedData.isActive ? sharedData.todos : deviceTodos
  const categories = sharedData.isActive ? sharedData.categories : deviceCategories
  const setTodos = useCallback((updater: SetStateAction<Task[]>) => {
    if (sharedData.isActive) sharedData.updateTodos(updater)
    else {
      setShouldPersistTodos(true)
      setDeviceTodos(updater)
    }
  }, [sharedData.isActive, sharedData.updateTodos])
  const setCategories = useCallback((updater: SetStateAction<TodoCategory[]>) => {
    if (sharedData.isActive) sharedData.updateCategories(updater)
    else setDeviceCategories(updater)
  }, [sharedData.isActive, sharedData.updateCategories])
  const [todosStorageError, setTodosStorageError] = useState(false)
  const [categoriesStorageError, setCategoriesStorageError] = useState(false)
  const [editor, setEditor] = useState<TodoEditorTarget | null>(null)
  const [deleted, setDeleted] = useState<DeletedTodo | null>(null)

  useEffect(() => {
    if (!shouldPersistTodos) return
    try {
      localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(deviceTodos))
      setTodosStorageError(false)
    } catch {
      setTodosStorageError(true)
    }
  }, [deviceTodos, shouldPersistTodos])

  useEffect(() => {
    try {
      localStorage.setItem(TODO_CATEGORY_STORAGE_KEY, JSON.stringify(deviceCategories))
      setCategoriesStorageError(false)
    } catch {
      setCategoriesStorageError(true)
    }
  }, [deviceCategories])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (sharedData.isActive) return
      if (event.key !== TODO_STORAGE_KEY && event.key !== TODO_CATEGORY_STORAGE_KEY) return
      const nextTodos = loadTodos()
      const nextCategories = loadCategories()
      const missing = nextTodos.records.map(task => task.category).filter(name => !nextCategories.some(category => category.name === name))
      setDeviceTodos(nextTodos.records)
      setShouldPersistTodos(nextTodos.shouldPersist)
      setDeviceCategories([...nextCategories, ...[...new Set(missing)].map(name => ({ id: crypto.randomUUID(), name, tone: "neutral" as const }))])
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [sharedData.isActive])

  useEffect(() => {
    if (!deleted) return
    const timer = window.setTimeout(() => setDeleted(null), 6500)
    return () => window.clearTimeout(timer)
  }, [deleted])

  const openCreate = useCallback(() => setEditor({ mode: "create" }), [])
  const openEdit = useCallback((id: string) => setEditor({ mode: "edit", id }), [])
  const closeEditor = useCallback(() => setEditor(null), [])

  const addTodo = useCallback((draft: TodoDraft) => {
    const creator = authUser ? members.find(member => member.uid === authUser.uid) : undefined
    const task: Task = { ...draft, id: crypto.randomUUID(), done: false, by: creator?.id ?? "A" }
    setTodos(previous => [task, ...previous])
  }, [authUser, members, setTodos])

  const updateTodo = useCallback((id: string, draft: TodoDraft) => {
    setTodos(previous => previous.map(task => task.id === id ? { ...task, ...draft } : task))
  }, [setTodos])

  const toggleTodo = useCallback((id: string) => {
    setTodos(previous => previous.map(task => task.id === id ? { ...task, done: !task.done } : task))
  }, [setTodos])

  const deleteTodo = useCallback((id: string) => {
    const index = todos.findIndex(task => task.id === id)
    if (index === -1) return
    setDeleted({ task: todos[index], index })
    setTodos(previous => previous.filter(task => task.id !== id))
  }, [todos, setTodos])

  const permanentlyDeleteTodo = useCallback((id: string) => {
    const task = todos.find(item => item.id === id)
    if (!task?.done) return
    if (sharedData.isActive) {
      sharedData.permanentlyDeleteTodo(id)
      return
    }
    setTodos(previous => previous.filter(item => item.id !== id))
  }, [todos, sharedData.isActive, sharedData.permanentlyDeleteTodo, setTodos])

  const undoDelete = useCallback(() => {
    if (!deleted) return
    setTodos(previous => {
      if (previous.some(task => task.id === deleted.task.id)) return previous
      const result = [...previous]
      result.splice(Math.min(deleted.index, result.length), 0, deleted.task)
      return result
    })
    setDeleted(null)
  }, [deleted, setTodos])

  const dismissDeleted = useCallback(() => setDeleted(null), [])

  const addCategory = useCallback((category: Omit<TodoCategory, "id">) => {
    setCategories(previous => previous.some(item => item.name === category.name) || previous.length >= 12 ? previous : [...previous, { ...category, id: crypto.randomUUID() }])
  }, [setCategories])

  const updateCategory = useCallback((id: string, category: TodoCategory) => {
    const current = categories.find(item => item.id === id)
    if (!current) return
    setCategories(previous => previous.map(item => item.id === id ? { ...category, id } : item))
    if (current.name !== category.name) {
      setTodos(previous => previous.map(task => task.category === current.name ? { ...task, category: category.name } : task))
    }
  }, [categories, setCategories, setTodos])

  const updateCategoryTone = useCallback((id: string, tone: TodoCategory["tone"]) => {
    setCategories(previous => previous.map(item => item.id === id ? { ...item, tone } : item))
  }, [setCategories])

  const deleteCategory = useCallback((id: string, moveToId?: string) => {
    const category = categories.find(item => item.id === id)
    if (!category) return
    const hasTodos = todos.some(task => task.category === category.name)
    const destination = moveToId ? categories.find(item => item.id === moveToId) : undefined
    if (hasTodos && (!destination || id === moveToId)) return
    if (hasTodos && destination) {
      setTodos(previous => previous.map(task => task.category === category.name ? { ...task, category: destination.name } : task))
    }
    setCategories(previous => previous.length <= 1 ? previous : previous.filter(item => item.id !== id))
  }, [categories, todos, setCategories, setTodos])

  const setCategoryOrder = useCallback((ids: string[]) => {
    setCategories(previous => {
      const byId = new Map(previous.map(category => [category.id, category]))
      const ordered = ids.flatMap(id => {
        const category = byId.get(id)
        if (!category) return []
        byId.delete(id)
        return [category]
      })
      return [...ordered, ...byId.values()]
    })
  }, [setCategories])

  const restoreLocalData = useCallback((nextTodos: Task[], nextCategories: TodoCategory[]) => {
    setTodos(removeLegacyDemoTasks(nextTodos))
    setCategories(nextCategories)
    setEditor(null)
    setDeleted(null)
  }, [setTodos, setCategories])

  const storageError = todosStorageError || categoriesStorageError
  const value = useMemo<TodoContextValue>(() => ({
    todos, categories, deviceTodos, deviceCategories, storageError, editor, deleted,
    openCreate, openEdit, closeEditor, addTodo, updateTodo, toggleTodo, deleteTodo, permanentlyDeleteTodo, undoDelete, dismissDeleted,
    addCategory, updateCategory, updateCategoryTone, deleteCategory, setCategoryOrder, restoreLocalData
  }), [todos, categories, deviceTodos, deviceCategories, storageError, editor, deleted, openCreate, openEdit, closeEditor, addTodo, updateTodo, toggleTodo, deleteTodo, permanentlyDeleteTodo, undoDelete, dismissDeleted, addCategory, updateCategory, updateCategoryTone, deleteCategory, setCategoryOrder, restoreLocalData])

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodos(): TodoContextValue {
  const context = useContext(TodoContext)
  if (!context) throw new Error("useTodos must be used within TodoProvider")
  return context
}
