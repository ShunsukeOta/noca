import { useMemo, type CSSProperties } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Clock3, ListTodo, MapPin, Plus } from "lucide-react"
import { type CalendarEvent, type Task } from "@/app/mock-data"
import { cn } from "@/lib/utils"

const PEOPLE = [
  { id: "A", label: "Aの予定", tone: "blue" },
  { id: "B", label: "Bの予定", tone: "peach" }
] as const

const HOUR_HEIGHT = 64
const MINUTE_HEIGHT = HOUR_HEIGHT / 60

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

type TimedBlock = { event: CalendarEvent; start: number; end: number; column: number; columns: number }

function layoutBlocks(events: CalendarEvent[]): TimedBlock[] {
  const sorted = events.filter(event => event.time).map(event => {
    const start = minutes(event.time!)
    return { event, start, end: event.endTime ? minutes(event.endTime) : Math.min(start + 60, 1440), column: 0, columns: 1 }
  }).sort((a, b) => a.start - b.start || b.end - a.end)

  const result: TimedBlock[] = []
  let group: TimedBlock[] = []
  let maxEnd = -1
  const finishGroup = () => {
    if (!group.length) return
    const columnEnds: number[] = []
    for (const block of group) {
      let column = columnEnds.findIndex(end => end <= block.start)
      if (column < 0) column = columnEnds.length
      columnEnds[column] = block.end
      block.column = column
    }
    group.forEach(block => { block.columns = columnEnds.length })
    result.push(...group)
    group = []
  }
  for (const block of sorted) {
    if (group.length && block.start >= maxEnd) {
      finishGroup()
      maxEnd = -1
    }
    group.push(block)
    maxEnd = Math.max(maxEnd, block.end)
  }
  finishGroup()
  return result
}

type DayTimelineProps = {
  events: CalendarEvent[]
  todos: Task[]
  onEditEvent: (id: string) => void
  onEditTodo: (id: string) => void
  onCreate: () => void
}

export function CalendarDayTimeline({ events, todos, onEditEvent, onEditTodo, onCreate }: DayTimelineProps) {
  const reduceMotion = useReducedMotion()
  const allDay = events.filter(event => !event.time)
  const timed = events.filter(event => Boolean(event.time))
  const timeRange = useMemo(() => {
    if (timed.length === 0) return null
    const earliest = Math.min(...timed.map(event => minutes(event.time!)))
    const latest = Math.max(...timed.map(event => event.endTime ? minutes(event.endTime) : Math.min(minutes(event.time!) + 60, 1440)))
    const firstHour = Math.max(0, Math.floor(earliest / 60) - 1)
    const lastHour = Math.min(24, Math.max(firstHour + 3, Math.ceil(latest / 60) + 1))
    return { firstHour, lastHour, height: (lastHour - firstHour) * HOUR_HEIGHT }
  }, [timed])

  const byPerson = (person: "A" | "B", timedOnly = false) =>
    events.filter(event => event.by === person && (timedOnly ? Boolean(event.time) : !event.time))

  return (
    <div className="space-y-3" data-testid="two-person-schedule">
      <div className="overflow-hidden rounded-[22px] border border-border bg-card shadow-[0_4px_20px_rgba(35,58,92,.04)]">
        <div className="grid grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)] border-b border-border bg-card">
          <div aria-hidden="true" className="flex items-center justify-center text-[10px] font-medium text-muted-foreground">予定</div>
          {PEOPLE.map(person => (
            <div key={person.id} data-testid={"person-header-" + person.id}
              className="flex min-h-[66px] min-w-0 flex-col items-center justify-center gap-1 border-l border-border/65 px-1">
              <span className="flex items-center gap-1.5">
                <span className={cn("flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  person.id === "A" ? "bg-[#d7e7ea] text-[#3e6470]" : "bg-[#f3dfda] text-[#90625a]")}>
                  {person.id}
                </span>
                <span className="truncate text-[12px] font-bold">{person.label}</span>
              </span>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {events.filter(event => event.by === person.id).length}件
              </span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)] border-b-2 border-border/70 bg-background/35"
          data-testid="all-day-strip">
          <span className="self-start pt-4 text-center text-[10px] font-semibold text-muted-foreground">終日</span>
          {PEOPLE.map(person => (
            <div key={person.id} data-testid={"all-day-" + person.id}
              className="flex min-h-[72px] min-w-0 flex-col gap-1.5 border-l border-border/60 p-1.5">
              {byPerson(person.id).length === 0 ? (
                <span className="m-auto text-[10px] text-muted-foreground/55">予定なし</span>
              ) : byPerson(person.id).map(event => (
                <button key={event.id} type="button" onClick={() => onEditEvent(event.id)}
                  aria-label={event.title + "を編集"} data-calendar-event={event.id}
                  className={cn("min-h-10 w-full rounded-[11px] border px-2 py-2 text-left text-[11px] font-semibold leading-snug",
                    person.id === "A"
                      ? "border-[#bddbd8] bg-[#e5f1ef] text-[#356d6a] dark:border-[#446e72] dark:bg-[#244145] dark:text-[#a2d7d5]"
                      : "border-[#edd0c2] bg-[#faeee8] text-[#9a6654] dark:border-[#835749] dark:bg-[#48332f] dark:text-[#f3cbb9]")}>
                  <span className="block break-words">{event.title}</span>
                  <span className="mt-0.5 block text-[9px] font-medium opacity-75">終日</span>
                </button>
              ))}
            </div>
          ))}
        </div>

        {timeRange ? (
          <div data-testid="timeline-grid" className="relative grid grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)]" style={{ height: timeRange.height }}>
            <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
              {Array.from({ length: timeRange.lastHour - timeRange.firstHour + 1 }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 h-px bg-border/70" style={{ top: i * HOUR_HEIGHT }} />
              ))}
            </div>
            <div aria-hidden="true" className="relative z-[1]">
              {Array.from({ length: timeRange.lastHour - timeRange.firstHour + 1 }, (_, i) => (
                <span key={i} className="absolute left-0 right-0 -translate-y-1/2 text-center text-[9px] font-medium tabular-nums text-muted-foreground"
                  style={{ top: i * HOUR_HEIGHT + (i === 0 ? 7 : 0) }}>
                  {String((timeRange.firstHour + i) % 24).padStart(2, "0")}:00
                </span>
              ))}
            </div>
            {PEOPLE.map(person => {
              const blocks = layoutBlocks(byPerson(person.id, true))
              return (
                <div key={person.id} data-testid={"timeline-lane-" + person.id}
                  className="relative z-[1] min-w-0 border-l border-border/65">
                  {blocks.map(({ event, start, end, column, columns }) => {
                    const top = (start - timeRange.firstHour * 60) * MINUTE_HEIGHT
                    const height = Math.max(39, (end - start) * MINUTE_HEIGHT - 3)
                    const style: CSSProperties = {
                      top,
                      height: Math.min(height, timeRange.height - top - 2),
                      left: `calc(${column / columns * 100}% + 3px)`,
                      width: `calc(${100 / columns}% - 6px)`
                    }
                    return (
                      <motion.button key={event.id} type="button" onClick={() => onEditEvent(event.id)}
                        aria-label={event.title + "を編集"} data-calendar-event={event.id}
                        data-start={event.time} data-end={event.endTime ?? ""}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                        animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0 : 0.2 }}
                        style={style}
                        className={cn(
                          "absolute z-10 flex min-w-0 flex-col overflow-hidden rounded-[11px] border-l-[3px] px-1.5 py-2 text-left shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          person.id === "A"
                            ? "border-[#5a9a9b] bg-[#e5f1ef] text-[#356d6a] dark:bg-[#244145] dark:text-[#a2d7d5]"
                            : "border-[#d59677] bg-[#faeee8] text-[#9a6654] dark:bg-[#48332f] dark:text-[#f3cbb9]"
                        )}>
                        <span className="line-clamp-3 break-words text-[11px] font-bold leading-snug">{event.title}</span>
                        <span className="mt-1 block w-full truncate text-[9px] font-semibold tabular-nums opacity-80">
                          {event.time}{event.endTime ? "–" + event.endTime : ""}
                        </span>
                        {event.address && height > 88 && (
                          <span className="mt-2 flex items-start gap-0.5 text-[9px] leading-tight opacity-80">
                            <MapPin className="mt-0.5 size-2.5 shrink-0" /><span className="line-clamp-2">{event.address}</span>
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              )
            })}
          </div>
        ) : (
          <div data-testid="timeline-empty" className="flex min-h-24 flex-col items-center justify-center gap-1 px-3 py-5 text-center">
            <Clock3 className="size-4 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">時間指定の予定はありません</span>
            <button type="button" onClick={onCreate} className="mt-1 min-h-11 rounded-lg px-3 text-[12px] font-bold text-primary">
              <Plus className="mr-1 inline size-3.5" />予定を追加
            </button>
          </div>
        )}
      </div>

      {todos.length > 0 && (
        <section aria-label="この日のTODO" className="overflow-hidden rounded-[18px] border border-border bg-card">
          <div className="flex items-center gap-2 border-b border-border px-3 py-2.5 text-[12px] font-bold text-muted-foreground">
            <ListTodo className="size-4" />期限のあるTODO <span className="ml-auto text-[11px] tabular-nums">{todos.length}件</span>
          </div>
          <AnimatePresence initial={false}>
            {todos.map(task => (
              <motion.button key={task.id} type="button" onClick={() => onEditTodo(task.id)}
                aria-label={task.title + "を編集"}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex min-h-[58px] w-full items-center gap-3 border-b border-border/70 px-3 py-3 text-left last:border-0">
                <span className={cn("flex size-[23px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold",
                  task.by === "A" ? "bg-[#d7e7ea] text-[#3e6470]" : "bg-[#f3dfda] text-[#90625a]")}>
                  {task.by}
                </span>
                <span className="min-w-0 flex-1 break-words text-[12px] font-semibold">{task.title}</span>
                <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">TODO</span>
              </motion.button>
            ))}
          </AnimatePresence>
        </section>
      )}
    </div>
  )
}
