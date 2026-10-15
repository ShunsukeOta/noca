import { useMemo, useState } from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns"
import { ja } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { preloadCalendarEditor } from "@/components/editor-loaders"
import { CalendarDayTimeline } from "@/components/calendar-day-timeline"
import { Button } from "@/components/ui/button"
import { useTodos } from "@/features/todos/todo-store"
import { useCalendar } from "@/features/calendar/calendar-store"
import { cn } from "@/lib/utils"

const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"]

export function CalendarPage() {
  const { todos, openEdit: editTodo } = useTodos()
  const { events, selectedDate, setSelectedDate, openCreate, openEdit } = useCalendar()
  const [direction, setDirection] = useState(1)
  const reduceMotion = useReducedMotion()
  const selectedDay = parseISO(selectedDate)
  const month = startOfMonth(selectedDay)
  const monthKey = format(month, "yyyy-MM")
  const today = new Date()

  const dates = useMemo(() => {
    const firstDay = parseISO(monthKey + "-01")
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(firstDay), { weekStartsOn: 0 }),
      end: endOfWeek(endOfMonth(firstDay), { weekStartsOn: 0 })
    })
  }, [monthKey])

  const counts = useMemo(() => {
    const result = new Map<string, { events: number; tasks: number }>()
    const increase = (date: string, kind: "events" | "tasks") => {
      const current = result.get(date) ?? { events: 0, tasks: 0 }
      current[kind] += 1
      result.set(date, current)
    }
    events.forEach(event => increase(event.date, "events"))
    todos.forEach(task => { if (task.dueDate && !task.done) increase(task.dueDate, "tasks") })
    return result
  }, [events, todos])

  const dayEvents = useMemo(() => events.filter(event => event.date === selectedDate).sort(
    (a, b) => (a.time ?? "").localeCompare(b.time ?? "") || a.title.localeCompare(b.title, "ja")
  ), [events, selectedDate])
  const dayTasks = useMemo(() => todos.filter(task => task.dueDate === selectedDate && !task.done), [todos, selectedDate])

  const changeMonth = (delta: number) => {
    setDirection(delta)
    setSelectedDate(format(addMonths(month, delta), "yyyy-MM-dd"))
  }

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <section className="noca-card rounded-2xl border border-border bg-card px-3.5 pb-5 pt-4">
        <div className="mb-6 flex items-center justify-between gap-1 px-1">
          <h2 className="shrink-0 whitespace-nowrap text-[17px] font-bold tracking-tight sm:text-[19px]">{format(month, "yyyy年 M月")}</h2>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button type="button" variant="ghost" onClick={() => { setDirection(today < month ? -1 : 1); setSelectedDate(format(today, "yyyy-MM-dd")) }}
              className="tap-target whitespace-nowrap rounded-xl px-1 text-xs text-primary">今日</Button>
            <Button type="button" variant="ghost" size="icon" aria-label="前の月" onClick={() => changeMonth(-1)}
              className="tap-target rounded-full text-muted-foreground"><ChevronLeft className="size-5" /></Button>
            <Button type="button" variant="ghost" size="icon" aria-label="次の月" onClick={() => changeMonth(1)}
              className="tap-target rounded-full text-muted-foreground"><ChevronRight className="size-5" /></Button>
          </div>
        </div>

        <div className="grid grid-cols-7">
          {daysOfWeek.map((day, index) => (
            <div key={day} className={cn("pb-3 text-center text-xs font-semibold",
              index === 0 ? "text-weekend-sunday" : index === 6 ? "text-weekend-saturday" : "text-muted-foreground")}>{day}</div>
          ))}
        </div>
        <AnimatePresence initial={false} mode="wait" custom={direction}>
          <m.div key={monthKey} custom={direction}
            initial={reduceMotion ? false : { opacity: 0, x: direction * 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, x: -direction * 12 }}
            transition={{ duration: reduceMotion ? 0 : 0.11, ease: "easeOut" }}
            className="grid grid-cols-7 gap-y-1">
            {dates.map(date => {
              const dateKey = format(date, "yyyy-MM-dd")
              const dayCount = counts.get(dateKey) ?? { events: 0, tasks: 0 }
              const count = dayCount.events + dayCount.tasks
              const selected = isSameDay(date, selectedDay)
              const isToday = isSameDay(date, today)
              return (
                <Button key={dateKey} type="button" variant="ghost" size="sm" data-calendar-date={dateKey}
                  aria-label={format(date, "M月d日", { locale: ja }) + (count ? "、予定" + count + "件" : "")}
                  aria-pressed={selected}
                  onClick={() => {
                    if (!isSameMonth(date, month)) setDirection(date < month ? -1 : 1)
                    setSelectedDate(dateKey)
                  }}
                  className="tap-target flex w-full flex-col items-center justify-center gap-1 rounded-xl px-0 py-1">
                  <span className={cn("relative flex size-[34px] items-center justify-center rounded-full text-[13px] font-semibold",
                    !isSameMonth(date, month) && "text-muted-foreground/40",
                    isToday && !selected && "ring-1 ring-primary text-primary",
                    selected && "text-primary-foreground")}>
                    {selected && <m.span layoutId="calendar-selected-day" aria-hidden="true"
                      className="absolute inset-0 rounded-full bg-primary"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 480, damping: 40 }} />}
                    <span className="relative z-10">{format(date, "d")}</span>
                  </span>
                  <span className="flex h-1 items-center justify-center gap-0.5">
                    {Array.from({ length: Math.min(dayCount.events, 2) }, (_, i) =>
                      <span key={"event-" + i} className="size-1 rounded-full bg-calendar-dot" />)}
                    {dayCount.tasks > 0 && <span className="size-1 rounded-full bg-primary" />}
                  </span>
                </Button>
              )
            })}
          </m.div>
        </AnimatePresence>
      </section>

      <section aria-label="選択日の予定">
        <div className="mb-3 flex items-center justify-between px-0.5">
          <h2 className="text-[18px] font-bold">{format(selectedDay, "M月d日（E）", { locale: ja })}</h2>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-[11px] font-semibold tabular-nums text-secondary-foreground">
            予定 {dayEvents.length}件
          </span>
        </div>
        <AnimatePresence initial={false} mode="wait">
          {dayEvents.length + dayTasks.length === 0 ? (
            <m.div key="empty" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.1 }}
              className="rounded-2xl border border-dashed border-border bg-card/65 py-9 text-center">
              <CalendarDays className="mx-auto mb-3 size-7 text-muted-foreground/45" strokeWidth={1.5} />
              <p className="text-sm font-semibold">この日の予定はありません</p>
              <Button type="button" variant="secondary" onClick={() => openCreate(selectedDate)} onPointerEnter={preloadCalendarEditor} onPointerDown={preloadCalendarEditor} onFocus={preloadCalendarEditor} className="mt-3 text-[13px]">＋ 予定を追加</Button>
            </m.div>
          ) : (
            <m.div key={selectedDate} initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.1 }}>
              <CalendarDayTimeline events={dayEvents} todos={dayTasks}
                onEditEvent={openEdit} onEditTodo={editTodo} onCreate={() => openCreate(selectedDate)} />
            </m.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  )
}
