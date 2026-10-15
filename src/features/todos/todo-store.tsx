import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { mockTasks, type Task, type TaskCategory, type TodoCategory } from "@/app/mock-data"

const STORAGE_KEY = "noca.todos.v1"
const CATEGORY_STORAGE_KEY = "noca.todo.categories.v1"
export const DEFAULT_TODO_CATEGORIES: TodoCategory[] = [
  { id: "default-outing", name: "おでかけ", tone: "peach" },
  { id: "default-life", name: "暮らし", tone: "green" },
  { id: "default-couple", name: "ふたり", tone: "lavender" },
  { id: "default-other", name: "その他", tone: "neutral" }
]
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
  undoDelete: () => void
  dismissDeleted: () => void
  addCategory: (category: Omit<TodoCategory, "id">) => void
  updateCategory: (id: string, category: TodoCategory) => void
  updateCategoryTone: (id: string, tone: TodoCategory["tone"]) => void
  deleteCategory: (id: string, moveToId?: string) => void
  setCategoryOrder: (ids: string[]) => void
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
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY)
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

function loadTodos(): Task[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return mockTasks
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isTask)) return mockTasks
    return parsed
  } catch {
    return mockTasks
  }
}

export function TodoProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => ({ todos: loadTodos(), categories: loadCategories() }))
  const [todos, setTodos] = useState<Task[]>(initial.todos)
  const [categories, setCategories] = useState<TodoCategory[]>(() => {
    const configured = initial.categories
    const missing = initial.todos.map(task => task.category).filter(name => !configured.some(category => category.name === name))
    return [...configured, ...[...new Set(missing)].map(name => ({ id: crypto.randomUUID(), name, tone: "neutral" as const }))]
  })
  const [todosStorageError, setTodosStorageError] = useState(false)
  const [categoriesStorageError, setCategoriesStorageError] = useState(false)
  const [editor, setEditor] = useState<TodoEditorTarget | null>(null)
  const [deleted, setDeleted] = useState<DeletedTodo | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
      setTodosStorageError(false)
    } catch {
      setTodosStorageError(true)
    }
  }, [todos])

  useEffect(() => {
    try {
      localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(categories))
      setCategoriesStorageError(false)
    } catch {
      setCategoriesStorageError(true)
    }
  }, [categories])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY && event.key !== CATEGORY_STORAGE_KEY) return
      const nextTodos = loadTodos()
      const nextCategories = loadCategories()
      const missing = nextTodos.map(task => task.category).filter(name => !nextCategories.some(category => category.name === name))
      setTodos(nextTodos)
      setCategories([...nextCategories, ...[...new Set(missing)].map(name => ({ id: crypto.randomUUID(), name, tone: "neutral" as const }))])
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  useEffect(() => {
    if (!deleted) return
    const timer = window.setTimeout(() => setDeleted(null), 6500)
    return () => window.clearTimeout(timer)
  }, [deleted])

  const openCreate = useCallback(() => setEditor({ mode: "create" }), [])
  const openEdit = useCallback((id: string) => setEditor({ mode: "edit", id }), [])
  const closeEditor = useCallback(() => setEditor(null), [])

  const addTodo = useCallback((draft: TodoDraft) => {
    const task: Task = { ...draft, id: crypto.randomUUID(), done: false, by: "A" }
    setTodos(previous => [task, ...previous])
  }, [])

  const updateTodo = useCallback((id: string, draft: TodoDraft) => {
    setTodos(previous => previous.map(task => task.id === id ? { ...task, ...draft } : task))
  }, [])

  const toggleTodo = useCallback((id: string) => {
    setTodos(previous => previous.map(task => task.id === id ? { ...task, done: !task.done } : task))
  }, [])

  const deleteTodo = useCallback((id: string) => {
    const index = todos.findIndex(task => task.id === id)
    if (index === -1) return
    setDeleted({ task: todos[index], index })
    setTodos(previous => previous.filter(task => task.id !== id))
  }, [todos])

  const undoDelete = useCallback(() => {
    if (!deleted) return
    setTodos(previous => {
      if (previous.some(task => task.id === deleted.task.id)) return previous
      const result = [...previous]
      result.splice(Math.min(deleted.index, result.length), 0, deleted.task)
      return result
    })
    setDeleted(null)
  }, [deleted])

  const dismissDeleted = useCallback(() => setDeleted(null), [])

  const addCategory = useCallback((category: Omit<TodoCategory, "id">) => {
    setCategories(previous => previous.some(item => item.name === category.name) || previous.length >= 12 ? previous : [...previous, { ...category, id: crypto.randomUUID() }])
  }, [])

  const updateCategory = useCallback((id: string, category: TodoCategory) => {
    const current = categories.find(item => item.id === id)
    if (!current) return
    setCategories(previous => previous.map(item => item.id === id ? { ...category, id } : item))
    if (current.name !== category.name) {
      setTodos(previous => previous.map(task => task.category === current.name ? { ...task, category: category.name } : task))
    }
  }, [categories])

  const updateCategoryTone = useCallback((id: string, tone: TodoCategory["tone"]) => {
    setCategories(previous => previous.map(item => item.id === id ? { ...item, tone } : item))
  }, [])

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
  }, [categories, todos])

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
  }, [])

  const storageError = todosStorageError || categoriesStorageError
  const value = useMemo<TodoContextValue>(() => ({
    todos, categories, storageError, editor, deleted,
    openCreate, openEdit, closeEditor, addTodo, updateTodo, toggleTodo, deleteTodo, undoDelete, dismissDeleted,
    addCategory, updateCategory, updateCategoryTone, deleteCategory, setCategoryOrder
  }), [todos, categories, storageError, editor, deleted, openCreate, openEdit, closeEditor, addTodo, updateTodo, toggleTodo, deleteTodo, undoDelete, dismissDeleted, addCategory, updateCategory, updateCategoryTone, deleteCategory, setCategoryOrder])

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodos(): TodoContextValue {
  const context = useContext(TodoContext)
  if (!context) throw new Error("useTodos must be used within TodoProvider")
  return context
}
