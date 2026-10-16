import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode, type SetStateAction } from "react"
import { format, isValid, parseISO } from "date-fns"
import { type CalendarEvent, type TaskCategory } from "@/app/mock-data"
import { removeLegacyDemoEvents } from "@/features/data/legacy-demo-data"
import { useWorkspaceDataSync } from "@/features/workspace/workspace-data-sync-context"

export const CALENDAR_EVENT_STORAGE_KEY = "noca.calendar.events.v1"
export const CALENDAR_SAMPLE_MIGRATION_KEYS = {
  v2: "noca.calendar.samples.v2",
  v3: "noca.calendar.samples.v3"
} as const
const categories: TaskCategory[] = ["暮らし", "おでかけ", "ふたり", "その他"]
const dateFormat = /^\d{4}-\d{2}-\d{2}$/
const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/

export type EventDraft = {
  title: string
  date: string
  time?: string
  endTime?: string
  category: TaskCategory
  by: "A" | "B" | "both"
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
    (item.by === "A" || item.by === "B" || item.by === "both") &&
    categories.includes(item.category as TaskCategory) &&
    (item.time === undefined || (typeof item.time === "string" && timeFormat.test(item.time))) &&
    (item.endTime === undefined || (typeof item.endTime === "string" && timeFormat.test(item.endTime))) &&
    (item.address === undefined || typeof item.address === "string") &&
    (item.memo === undefined || typeof item.memo === "string")
}

function readEvents(): { records: CalendarEvent[]; shouldPersist: boolean } {
  let raw: string | null
  try {
    raw = localStorage.getItem(CALENDAR_EVENT_STORAGE_KEY)
  } catch {
    return { records: [], shouldPersist: false }
  }
  if (raw === null) return { records: [], shouldPersist: true }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || !parsed.every(isCalendarEvent)) return { records: [], shouldPersist: false }
    return { records: removeLegacyDemoEvents(parsed), shouldPersist: true }
  } catch {
    return { records: [], shouldPersist: false }
  }
}

type CalendarContextValue = {
  events: CalendarEvent[]
  deviceEvents: CalendarEvent[]
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
  restoreLocalData: (events: CalendarEvent[]) => void
}

const CalendarContext = createContext<CalendarContextValue | null>(null)

export function CalendarProvider({ children }: { children: ReactNode }) {
  const sharedData = useWorkspaceDataSync()
  const [initialEvents] = useState(readEvents)
  const [deviceEvents, setDeviceEvents] = useState<CalendarEvent[]>(initialEvents.records)
  const [shouldPersistEvents, setShouldPersistEvents] = useState(initialEvents.shouldPersist)
  const events = sharedData.isActive ? sharedData.events : deviceEvents
  const setEvents = useCallback((updater: SetStateAction<CalendarEvent[]>) => {
    if (sharedData.isActive) sharedData.updateEvents(updater)
    else {
      setShouldPersistEvents(true)
      setDeviceEvents(updater)
    }
  }, [sharedData.isActive, sharedData.updateEvents])
  const [selectedDate, setSelectedDateState] = useState(() => format(new Date(), "yyyy-MM-dd"))
  const [editor, setEditor] = useState<EventEditor | null>(null)
  const [deleted, setDeleted] = useState<RemovedEvent | null>(null)
  const [storageError, setStorageError] = useState(false)

  useEffect(() => {
    if (!shouldPersistEvents) return
    try {
      localStorage.setItem(CALENDAR_EVENT_STORAGE_KEY, JSON.stringify(deviceEvents))
      setStorageError(false)
    } catch {
      setStorageError(true)
    }
  }, [deviceEvents, shouldPersistEvents])

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (sharedData.isActive) return
      if (event.key === CALENDAR_EVENT_STORAGE_KEY) {
        const next = readEvents()
        setDeviceEvents(next.records)
        setShouldPersistEvents(next.shouldPersist)
      }
    }
    window.addEventListener("storage", sync)
    return () => window.removeEventListener("storage", sync)
  }, [sharedData.isActive])

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
  }, [setEvents])
  const updateEvent = useCallback((id: string, draft: EventDraft) => {
    setEvents(previous => previous.map(event => event.id === id ? { ...event, ...draft } : event))
    setSelectedDateState(draft.date)
  }, [setEvents])
  const deleteEvent = useCallback((id: string) => {
    const index = events.findIndex(event => event.id === id)
    if (index < 0) return
    setDeleted({ event: events[index], index })
    setEvents(previous => previous.filter(event => event.id !== id))
  }, [events, setEvents])
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
  }, [deleted, setEvents])
  const dismissDeleted = useCallback(() => setDeleted(null), [])
  const restoreLocalData = useCallback((nextEvents: CalendarEvent[]) => {
    setEvents(removeLegacyDemoEvents(nextEvents))
    setEditor(null)
    setDeleted(null)
  }, [setEvents])

  const value = useMemo<CalendarContextValue>(() => ({
    events, deviceEvents, selectedDate, setSelectedDate, editor, deleted, storageError,
    openCreate, openEdit, closeEditor, addEvent, updateEvent, deleteEvent, undoDelete, dismissDeleted, restoreLocalData
  }), [events, deviceEvents, selectedDate, setSelectedDate, editor, deleted, storageError,
    openCreate, openEdit, closeEditor, addEvent, updateEvent, deleteEvent, undoDelete, dismissDeleted, restoreLocalData])

  return <CalendarContext.Provider value={value}>{children}</CalendarContext.Provider>
}

export function useCalendar() {
  const calendar = useContext(CalendarContext)
  if (!calendar) throw new Error("useCalendar requires CalendarProvider")
  return calendar
}
