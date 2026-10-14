import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { format, isValid, parseISO } from "date-fns"
import { mockEvents, type CalendarEvent, type TaskCategory } from "@/app/mock-data"

const STORAGE_KEY = "noca.calendar.events.v1"
const categories: TaskCategory[] = ["暮らし", "おでかけ", "ふたり", "その他"]
const dateFormat = /^\d{4}-\d{2}-\d{2}$/
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/

export type EventDraft = {
  title: string
  date: string
  time?: string
  endTime?: string
  category: TaskCategory
  by: "A" | "B"
  address?: string
  memo?: string
}
type EventEditor = { mode: "create"; date: string } | { mode: "edit"; id: string }
type RemovedEvent = { event: CalendarEvent; index: number }

export function isCalendarDate(date: string) {
  return dateFormat.test(date) && isValid(parseISO(date)) && format(parseISO(date), "yyyy-MM-dd") === date
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
  if (!value || typeof value !== "object") return false
  const item = value as Partial<CalendarEvent>
  return typeof item.id === "string" && typeof item.title === "string" &&
    typeof item.date === "string" && isCalendarDate(item.date) &&
    (item.by === "A" || item.by === "B") &&
    categories.includes(item.category as TaskCategory) &&
    (item.time === undefined || (typeof item.time === "string" && timeFormat.test(item.time))) &&
    (item.endTime === undefined || (typeof item.endTime === "string" && timeFormat.test(item.endTime))) &&
    (item.address === undefined || typeof item.address === "string") &&
    (item.memo === undefined || typeof item.memo === "string")
}

function readEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === null) return mockEvents
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isCalendarEvent)) return mockEvents
    // 初回だけ旧デモ版へ新しい2人用サンプルを追加。編集済みの予定や削除操作は上書きしない
    if (localStorage.getItem("noca.calendar.samples.v2") !== "done" &&
      parsed.some(event => ["e1", "e2", "e3", "e4"].includes(event.id))) {
      const sampleIds = new Set(parsed.map(event => event.id))
      const additional = mockEvents.filter(event => event.id.startsWith("demo-") && !sampleIds.has(event.id))
      localStorage.setItem("noca.calendar.samples.v2", "done")
      return [...parsed, ...additional]
    }
    return parsed
  } catch {
    return mockEvents
  }
}

type CalendarContextValue = {
  events: CalendarEvent[]
  selectedDate: string
  setSelectedDate: (date: string) => void
  editor: EventEditor | null
  deleted: RemovedEvent | null
  storageError: boolean
  openCreate: (date?: string) => void
  openEdit: (id: string) => void
  closeEditor: () => void
  addEvent: (draft: EventDraft) => void
  updateEvent: (id: string, draft: EventDraft) => void
  deleteEvent: (id: string) => void
  undoDelete: () => void
  dismissDeleted: () => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function CalendarProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<CalendarEvent[]>(readEvents)
  const [selectedDate, setSelectedDateState] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [editor, setEditor] = useState<EventEditor | null>(null)
  const [deleted, setDeleted] = useState<RemovedEvent | null>(null)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [events])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) setEvents(readEvents())
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [])

  useEffect(() => {
    if (!deleted) return
    const timeout = window.setTimeout(() => setDeleted(null), 6500)
    return () => window.clearTimeout(timeout)
  }, [deleted])

  const setSelectedDate = useCallback((date: string) => {
    if (isCalendarDate(date)) setSelectedDateState(date)
  }, [])
  const openCreate = useCallback((date?: string) => {
    setEditor({ mode: "create", date: date && isCalendarDate(date) ? date : selectedDate })
  }, [selectedDate])
  const openEdit = useCallback((id: string) => setEditor({ mode: "edit", id }), [])
  const closeEditor = useCallback(() => setEditor(null), [])

  const addEvent = useCallback((draft: EventDraft) => {
    setEvents(previous => [{ ...draft, id: crypto.randomUUID() }, ...previous])
    setSelectedDateState(draft.date)
  }, [])
  const updateEvent = useCallback((id: string, draft: EventDraft) => {
    setEvents(previous => previous.map(event => event.id === id ? { ...event, ...draft } : event))
    setSelectedDateState(draft.date)
  }, [])
  const deleteEvent = useCallback((id: string) => {
    const index = events.findIndex(event => event.id === id)
    if (index < 0) return
    setDeleted({ event: events[index], index })
    setEvents(previous => previous.filter(event => event.id !== id))
  }, [events])
  const undoDelete = useCallback(() => {
    if (!deleted) return
    setEvents(previous => {
      if (previous.some(event => event.id === deleted.event.id)) return previous
      const restored = [...previous]
      restored.splice(Math.min(deleted.index, restored.length), 0, deleted.event)
      return restored
    })
    setSelectedDateState(deleted.event.date)
    setDeleted(null)
  }, [deleted])
  const dismissDeleted = useCallback(() => setDeleted(null), [])

  const value = useMemo<CalendarContextValue>(() => ({
    events, selectedDate, setSelectedDate, editor, deleted, storageError,
    openCreate, openEdit, closeEditor, addEvent, updateEvent, deleteEvent, undoDelete, dismissDeleted
  }), [events, selectedDate, setSelectedDate, editor, deleted, storageError,
    openCreate, openEdit, closeEditor, addEvent, updateEvent, deleteEvent, undoDelete, dismissDeleted])

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar() {
  const calendar = useContext(CalendarContext)
  if (!calendar) throw new Error("useCalendar requires CalendarProvider")
  return calendar
}
