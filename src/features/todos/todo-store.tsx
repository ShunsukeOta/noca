import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { mockTasks, type Task, type TaskCategory } from "@/app/mock-data"

const STORAGE_KEY = "noca.todos.v1"
const categories: TaskCategory[] = ["暮らし", "おでかけ", "ふたり", "その他"]

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
}

const TodoContext = createContext<TodoContextValue | null>(null)

function isTask(value: unknown): value is Task {
  if (!value || typeof value !== "object") return false
  const data = value as Partial<Task>
  return typeof data.id === "string" &&
    typeof data.title === "string" &&
    categories.includes(data.category as TaskCategory) &&
    typeof data.done === "boolean" &&
    (data.by === "A" || data.by === "B") &&
    (data.dueDate === undefined || typeof data.dueDate === "string")
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
  const [todos, setTodos] = useState<Task[]>(loadTodos)
  const [storageError, setStorageError] = useState(false)
  const [editor, setEditor] = useState<TodoEditorTarget | null>(null)
  const [deleted, setDeleted] = useState<DeletedTodo | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(todos))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [todos])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return
      setTodos(loadTodos())
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

  const value = useMemo<TodoContextValue>(() => ({
    todos, storageError, editor, deleted,
    openCreate, openEdit, closeEditor, addTodo, updateTodo, toggleTodo, deleteTodo, undoDelete, dismissDeleted
  }), [todos, storageError, editor, deleted, openCreate, openEdit, closeEditor, addTodo, updateTodo, toggleTodo, deleteTodo, undoDelete, dismissDeleted])

  return <TodoContext.Provider value={value}>{children}</TodoContext.Provider>
}

export function useTodos(): TodoContextValue {
  const context = useContext(TodoContext)
  if (!context) throw new Error("useTodos must be used within TodoProvider")
  return context
}
