import { useMemo, type CSSProperties } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Clock3, ListTodo, MapPin, Plus } from "lucide-react"
import { type CalendarEvent, type Task } from "@/app/mock-data"
import { cn } from "@/lib/utils"

type EventOwner = CalendarEvent["by"]
const PEOPLE: { id: EventOwner; label: string; avatar: string }[] = [
  { id: "A", label: "Aの予定", avatar: "A" },
  { id: "B", label: "Bの予定", avatar: "B" },
  { id: "both", label: "ふたりの予定", avatar: "2" }
]

const HOUR_HEIGHT = 54
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const timeGrid = "grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)]"
const allDayGrid = "grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

type TimedBlock = {
  event: CalendarEvent
  start: number
  end: number
  depth: number
}

/** Within overlapping groups, paint longer appointments first, shorter ones
 * on top and slightly inset, rather than splitting already-narrow iPhone lanes. */
function layoutBlocks(events: CalendarEvent[]): TimedBlock[] {
  const items = events.filter(event => event.time).map(event => {
    const start = minutes(event.time!)
    return { event, start, end: event.endTime ? minutes(event.endTime) : Math.min(start + 60, 1440), depth: 0 }
  }).sort((a, b) => a.start - b.start || b.end - a.end)

  const groups: TimedBlock[][] = []
  let group: TimedBlock[] = []
  let maxEnd = -1
  for (const block of items) {
    if (group.length && block.start >= maxEnd) {
      groups.push(group)
      group = []
      maxEnd = -1
    }
    group.push(block)
    maxEnd = Math.max(maxEnd, block.end)
  }
  if (group.length) groups.push(group)

  return groups.flatMap(itemsInGroup => {
    const placed: TimedBlock[] = []
    const ordered = [...itemsInGroup].sort(
      (a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start || a.event.id.localeCompare(b.event.id)
    )
    ordered.forEach(block => {
      // Count overlapping *visible* layers, with a cap so even many events
      // keep enough width for titles and remain usable.
      block.depth = Math.min(3, placed.filter(other =>
        other.start < block.end && block.start < other.end
      ).reduce((depth, other) => Math.max(depth, other.depth + 1), 0))
      placed.push(block)
    })
    return ordered
  })
}

const ownerTone: Record<EventOwner, string> = {
  A: "border-[#5a9a9b] bg-[#e5f1ef] text-[#356d6a] dark:bg-[#244145] dark:text-[#a2d7d5]",
  B: "border-[#d59677] bg-[#faeee8] text-[#9a6654] dark:bg-[#48332f] dark:text-[#f3cbb9]",
  both: "border-[#9586c6] bg-[#ece8f8] text-[#63568d] dark:bg-[#383451] dark:text-[#d5caf6]"
}

const ownerAvatar: Record<EventOwner, string> = {
  A: "bg-[#d7e7ea] text-[#3e6470]",
  B: "bg-[#f3dfda] text-[#90625a]",
  both: "bg-[#e7e2f4] text-[#70649c] dark:bg-[#403b5c] dark:text-[#d5caf6]"
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
  const timed = events.filter(event => Boolean(event.time))
  const timeRange = useMemo(() => {
    if (timed.length === 0) return null
    const earliest = Math.min(...timed.map(event => minutes(event.time!)))
    const latest = Math.max(...timed.map(event => event.endTime ? minutes(event.endTime) : Math.min(minutes(event.time!) + 60, 1440)))
    const firstHour = Math.max(0, Math.floor(earliest / 60) - 1)
    const lastHour = Math.min(24, Math.max(firstHour + 3, Math.ceil(latest / 60) + 1))
    return { firstHour, lastHour, height: (lastHour - firstHour) * HOUR_HEIGHT }
  }, [timed])

  const eventsFor = (owner: EventOwner, timedOnly = false) =>
    events.filter(event => event.by === owner && (timedOnly ? Boolean(event.time) : !event.time))

  const timedBlock = ({ event, start, end, depth }: TimedBlock, owner: EventOwner, shared = false) => {
    if (!timeRange) return null
    const top = (start - timeRange.firstHour * 60) * MINUTE_HEIGHT
    const height = Math.min(Math.max(34, (end - start) * MINUTE_HEIGHT - 3), timeRange.height - top - 2)
    const inset = 3 + depth * 8
    const style: CSSProperties = {
      top,
      height,
      left: inset,
      right: 3 + depth * 5,
      zIndex: 10 + depth
    }
    return (
      <motion.button key={event.id} type="button" onClick={() => onEditEvent(event.id)}
        aria-label={event.title + "を編集"}
        data-calendar-event={event.id}
        data-owner={owner}
        data-depth={depth}
        data-start={event.time} data-end={event.endTime ?? ""}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.19 }}
        style={style}
        className={cn(
          "pointer-events-auto absolute flex min-w-0 flex-col overflow-hidden rounded-[11px] border-l-[3px] px-1.5 py-2 text-left shadow-[0_2px_6px_rgba(30,50,70,.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          ownerTone[owner],
          shared && "shadow-[0_4px_12px_rgba(76,61,113,.17)]"
        )}>
        <span className="line-clamp-3 break-words text-[11px] font-bold leading-snug">{event.title}</span>
        <span className="mt-1 block w-full truncate text-[9px] font-semibold tabular-nums opacity-80">
          {event.time}{event.endTime ? "–" + event.endTime : ""}
        </span>
        {event.address && height > 80 && (
          <span className="mt-2 flex items-start gap-0.5 text-[9px] leading-tight opacity-80">
            <MapPin className="mt-0.5 size-2.5 shrink-0" /><span className="line-clamp-2">{event.address}</span>
          </span>
        )}
      </motion.button>
    )
  }

  return (
    <div className="space-y-3" data-testid="two-person-schedule">
      <div data-testid="schedule-surface" className="bg-transparent">
        <div className={cn("grid border-b border-border/75", allDayGrid)}>
          <div aria-hidden="true" className="flex items-center justify-center text-[10px] font-medium text-muted-foreground">予定</div>
          {PEOPLE.map(person => (
            <div key={person.id} data-testid={"person-header-" + person.id}
              className="flex min-h-[53px] min-w-0 flex-col items-center justify-center gap-0.5 border-l border-border/50 px-0.5">
              <span className="flex min-w-0 items-center justify-center gap-1">
                <span className={cn("size-[17px] shrink-0 items-center justify-center rounded-full text-[9px] font-bold", person.id === "both" ? "hidden min-[375px]:flex" : "flex", ownerAvatar[person.id])}>
                  {person.avatar}
                </span>
                <span className="truncate text-[10px] font-bold">{person.label}</span>
              </span>
              <span className="text-[9px] tabular-nums text-muted-foreground">
                {events.filter(event => event.by === person.id).length}件
              </span>
            </div>
          ))}
        </div>

        <div className={cn("grid border-b border-border/70", allDayGrid)} data-testid="all-day-strip">
          <span className="self-start pt-3 text-center text-[10px] font-semibold text-muted-foreground">終日</span>
          {PEOPLE.map(person => {
            const allDayEvents = eventsFor(person.id)
            return (
              <div key={person.id} data-testid={"all-day-" + person.id}
                className="flex min-h-[56px] min-w-0 flex-col gap-1 border-l border-border/50 px-1 py-1.5">
                {allDayEvents.length === 0 ? (
                  <span className="m-auto text-[9px] text-muted-foreground/55">—</span>
                ) : allDayEvents.map(event => (
                  <button key={event.id} type="button" onClick={() => onEditEvent(event.id)}
                    aria-label={event.title + "を編集"} data-calendar-event={event.id} data-owner={event.by}
                    className={cn(
                      "min-h-8 w-full rounded-[10px] border-l-[3px] px-1.5 py-1.5 text-left text-[11px] font-bold leading-snug",
                      ownerTone[event.by]
                    )}>
                    <span className="block break-words">{event.title}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>

        {timeRange ? (
          <div data-testid="timeline-grid" className={cn("relative grid", timeGrid)} style={{ height: timeRange.height }}>
            <div className="pointer-events-none absolute inset-0 z-0" aria-hidden="true">
              {Array.from({ length: timeRange.lastHour - timeRange.firstHour + 1 }, (_, i) => (
                <div key={i} className="absolute left-0 right-0 h-px bg-border/55" style={{ top: i * HOUR_HEIGHT }} />
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
            {(["A", "B"] as const).map(person => (
              <div key={person} data-testid={"timeline-lane-" + person}
                className="pointer-events-none relative z-[2] min-w-0 border-l border-border/50">
                {layoutBlocks(eventsFor(person, true)).map(block => timedBlock(block, person))}
              </div>
            ))}
            {/* This layer spans A+B, not a third narrow time column. Its blocks
                sit beneath personal appointments so both remain tappable. */}
            <div data-testid="timeline-lane-both"
              className="pointer-events-none absolute bottom-0 right-0 top-0 z-[1]" style={{ left: 42 }}>
              {layoutBlocks(eventsFor("both", true)).map(block => timedBlock(block, "both", true))}
            </div>
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
