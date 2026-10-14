import { useMemo, useState } from "react"
import { addMonths, eachDayOfInterval, endOfWeek, endOfMonth, format, isSameDay, isSameMonth, parseISO, startOfMonth, startOfWeek } from "date-fns"
import { ja } from "date-fns/locale"
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, ListTodo, MapPin } from "lucide-react"
import { mockEvents, mockTasks } from "@/app/mock-data"
import { cn } from "@/lib/utils"

const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"]

export function CalendarPage() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const today = new Date()
  const dates = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
  }), [month])
  const key = format(selectedDate, "yyyy-MM-dd")
  const events = mockEvents.filter((event) => event.date === key)
  const tasks = mockTasks.filter((task) => task.dueDate === key && !task.done)

  const changeMonth = (direction: number) => {
    const next = addMonths(month, direction)
    setMonth(next)
    setSelectedDate(startOfMonth(next))
  }

  return (
    <div className="space-y-6" data-testid="calendar-page">
      <div>
        <p className="mb-1 text-[11px] font-bold tracking-[.17em] text-muted-foreground">OUR SCHEDULE</p>
        <h1 className="text-[32px] font-bold leading-[1.3] tracking-[-.045em]">カレンダー</h1>
        <p className="mt-2 text-sm text-muted-foreground">ふたりの予定を、ひと目で。</p>
      </div>

      <section className="noca-card rounded-[23px] border border-border bg-card px-3.5 pb-5 pt-4">
        <div className="mb-6 flex items-center justify-between px-2">
          <h2 className="text-[19px] font-bold tracking-tight">{format(month, "yyyy年 M月")}</h2>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => { setMonth(startOfMonth(today)); setSelectedDate(today) }}
              className="tap-target rounded-xl px-2 text-xs font-semibold text-primary hover:bg-secondary">今日</button>
            <button type="button" aria-label="前の月" onClick={() => changeMonth(-1)} className="tap-target flex items-center justify-center rounded-full hover:bg-secondary"><ChevronLeft className="size-5" /></button>
            <button type="button" aria-label="次の月" onClick={() => changeMonth(1)} className="tap-target flex items-center justify-center rounded-full hover:bg-secondary"><ChevronRight className="size-5" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-y-1">
          {daysOfWeek.map((item, i) => (
            <div key={item} className={cn("pb-3 text-center text-xs font-semibold", i === 0 ? "text-[#c28086]" : i === 6 ? "text-[#7798be]" : "text-muted-foreground")}>{item}</div>
          ))}
          {dates.map((date) => {
            const dateKey = format(date, "yyyy-MM-dd")
            const count = mockEvents.filter((event) => event.date === dateKey).length + mockTasks.filter((task) => task.dueDate === dateKey && !task.done).length
            const selected = isSameDay(date, selectedDate)
            const isToday = isSameDay(date, today)
            return (
              <button key={dateKey} type="button"
                aria-label={format(date, "M月d日", { locale: ja }) + (count ? "、予定" + count + "件" : "")}
                aria-pressed={selected}
                onClick={() => { setSelectedDate(date); if (!isSameMonth(date, month)) setMonth(startOfMonth(date)) }}
                className="tap-target flex w-full flex-col items-center justify-center gap-1 rounded-xl px-0 py-1">
                <span className={cn("flex size-[34px] items-center justify-center rounded-full text-[13px] font-semibold", !isSameMonth(date, month) && "text-muted-foreground/40", isToday && !selected && "ring-1 ring-primary text-primary", selected && "bg-primary text-primary-foreground")}>
                  {format(date, "d")}
                </span>
                <span className="flex h-1 items-center justify-center gap-0.5">
                  {count ? Array.from({ length: Math.min(count, 3) }, (_, i) => <span key={i} className={cn("size-1 rounded-full bg-[#84a9a0]", selected && "bg-primary")} />) : null}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold tracking-[.1em] text-muted-foreground">SELECTED DAY</p>
            <h2 className="mt-1 text-[18px] font-bold">{format(selectedDate, "M月d日（E）", { locale: ja })}</h2>
          </div>
          <span className="rounded-full bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground">{events.length + tasks.length} 件</span>
        </div>
        {events.length + tasks.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border bg-card/65 py-10 text-center">
            <CalendarDays className="mx-auto mb-3 size-7 text-muted-foreground/45" strokeWidth={1.5} />
            <p className="text-sm font-semibold">この日の予定はありません</p>
            <p className="mt-1 text-xs text-muted-foreground">ゆったり過ごすのもいいですね。</p>
          </div>
        ) : (
          <div className="noca-card overflow-hidden rounded-[20px] border border-border bg-card">
            {events.map((event) => (
              <div key={event.id} className="flex items-center gap-3 border-b border-border/60 px-4 py-4 last:border-b-0">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#e6eee8] text-[#648874] dark:bg-[#2c443a] dark:text-[#a4d1ae]"><MapPin className="size-5" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{event.title}</p><p className="mt-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{event.time ?? "終日"} · {event.category}</p></div>
                <span className="text-[10px] font-semibold text-muted-foreground">{event.by}</span>
              </div>
            ))}
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center gap-3 border-t border-border/60 px-4 py-4 first:border-t-0">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-secondary text-primary"><ListTodo className="size-5" /></div>
                <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{task.title}</p><p className="mt-1 text-[11px] text-muted-foreground">TODO · {task.category}</p></div>
                <span className="rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">TODO</span>
              </div>
            ))}
          </div>
        )}
      </section>
      <p className="text-center text-[11px] text-muted-foreground/80">Phase 1A ・ サンプルデータで表示中</p>
    </div>
  )
}
