import { useMemo, useState, type CSSProperties } from "react"
import { AnimatePresence, m, useReducedMotion } from "motion/react"
import { Clock3, ListTodo, MapPin, Plus } from "lucide-react"
import { type CalendarEvent, type Task } from "@/app/mock-data"
import { Button, buttonVariants } from "@/components/ui/button"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { OwnerAvatar, ownerSurfaceTone } from "@/components/owner-ui"
import { cn } from "@/lib/utils"
import { preloadCalendarEditor, preloadTodoEditor } from "@/components/editor-loaders"
import { useWorkspaceMembership } from "@/features/workspace/workspace-membership"

type EventOwner = CalendarEvent["by"]
const PEOPLE = [
  { id: "A", label: "Aの予定" },
  { id: "B", label: "Bの予定" }
] as const

const HOUR_HEIGHT = 54
const MINUTE_HEIGHT = HOUR_HEIGHT / 60
const pairedGrid = "grid-cols-[42px_minmax(0,1fr)_minmax(0,1fr)]"
const soloGrid = "grid-cols-[42px_minmax(0,1fr)]"
const MIN_BLOCK_PX = 36

function minutes(time: string) {
  const [hour, minute] = time.split(":").map(Number)
  return hour * 60 + minute
}

function visualEnd(block: Pick<TimedBlock, "start" | "end">) {
  const height = Math.max(MIN_BLOCK_PX, (block.end - block.start) * MINUTE_HEIGHT - 3)
  return Math.max(block.end, block.start + height / MINUTE_HEIGHT)
}

type TimedBlock = {
  event: CalendarEvent
  start: number
  end: number
}

type OverlapSummary = {
  primary: TimedBlock
  events: TimedBlock[]
  overlapStart: number
}

type TimelineLayout = {
  blocks: TimedBlock[]
  summaries: OverlapSummary[]
}

/** Show the longest appointment in each overlap group and summarize the rest. */
function layoutBlocks(events: CalendarEvent[]): TimelineLayout {
  const items = events.filter(event => event.time).map(event => {
    const start = minutes(event.time!)
    return { event, start, end: event.endTime ? minutes(event.endTime) : Math.min(start + 60, 1440) }
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
    maxEnd = Math.max(maxEnd, visualEnd(block))
  }
  if (group.length) groups.push(group)

  const blocks: TimedBlock[] = []
  const summaries: OverlapSummary[] = []

  for (const itemsInGroup of groups) {
    const ordered = [...itemsInGroup].sort(
      (a, b) => (b.end - b.start) - (a.end - a.start) || a.start - b.start || a.event.id.localeCompare(b.event.id)
    )
    const [primary, ...overlapping] = ordered
    if (!primary) continue
    blocks.push(primary)

    if (overlapping.length > 0) {
      const primaryVisualEnd = visualEnd(primary)
      const intersecting = overlapping.filter(item => item.start < primaryVisualEnd && primary.start < visualEnd(item))
      const overlapStart = intersecting.length > 0
        ? Math.min(...intersecting.map(item => Math.max(primary.start, item.start)))
        : Math.max(primary.start, Math.min(...overlapping.map(item => item.start)))
      summaries.push({
        primary,
        events: overlapping.sort((a, b) => a.start - b.start || a.event.title.localeCompare(b.event.title, "ja")),
        overlapStart
      })
    }
  }

  return {
    blocks: blocks.sort((a, b) => a.start - b.start || a.end - b.end),
    summaries
  }
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
  const { isPaired } = useWorkspaceMembership()
  const [selectedOverlap, setSelectedOverlap] = useState<OverlapSummary | null>(null)
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
  const hasAllDayEvents = events.some(event => !event.time)

  const timelineLayouts = useMemo(() => ({
    A: layoutBlocks(events.filter(event => event.by === "A" && event.time)),
    B: layoutBlocks(events.filter(event => event.by === "B" && event.time)),
    both: layoutBlocks(events.filter(event => event.by === "both" && event.time)),
    solo: layoutBlocks(events.filter(event => event.time))
  }), [events])
  const ownerTone = (owner: EventOwner) => ownerSurfaceTone[isPaired ? owner : "A"]
  const selectedOverlapEvents = selectedOverlap
    ? [selectedOverlap.primary, ...selectedOverlap.events].sort((a, b) => a.start - b.start || a.event.title.localeCompare(b.event.title, "ja"))
    : []

  const timedBlock = ({ event, start, end }: TimedBlock, owner: EventOwner, shared = false, hasSummary = false) => {
    if (!timeRange) return null
    const top = (start - timeRange.firstHour * 60) * MINUTE_HEIGHT
    const height = Math.min(Math.max(MIN_BLOCK_PX, (end - start) * MINUTE_HEIGHT - 3), timeRange.height - top - 2)
    const short = height < 49
    const style: CSSProperties = {
      top,
      height,
      left: 3,
      right: 3,
      zIndex: 10
    }
    return (
      <m.button key={event.id} type="button" onClick={() => onEditEvent(event.id)} onPointerEnter={preloadCalendarEditor} onPointerDown={preloadCalendarEditor} onFocus={preloadCalendarEditor}
        aria-label={event.title + "を編集"}
        title={event.title + " " + event.time + (event.endTime ? "–" + event.endTime : "")}
        data-calendar-event={event.id}
        data-owner={owner}
        data-depth="0"
        data-compact={short}
        data-start={event.time} data-end={event.endTime ?? ""}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: reduceMotion ? 0 : 0.13 }}
        style={style}
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm", className: "p-0 whitespace-normal" }),
          "pointer-events-auto absolute block min-w-0 overflow-hidden rounded-[11px] border-l-[3px] text-left shadow-[0_2px_6px_rgba(30,50,70,.12)]",
          ownerSurfaceTone[owner],
          shared && "shadow-[0_4px_12px_rgba(76,61,113,.17)]"
        )}>
        <span data-testid={"event-label-" + event.id}
          className={cn("absolute inset-x-1.5 top-1 flex min-w-0 flex-col text-[11px] font-bold", hasSummary && "pr-14")}>
          <span className={cn("block min-w-0 break-words text-[11px] font-bold leading-[14px]",
            short ? "truncate" : "line-clamp-3")}>
            {event.title}
          </span>
          {!short && (
            <span className="mt-0.5 block w-full truncate text-[9px] font-semibold tabular-nums opacity-80">
              {event.time}{event.endTime ? "–" + event.endTime : ""}
            </span>
          )}
          {!short && event.address && height > 100 && (
            <span className="mt-1.5 flex items-start gap-0.5 text-[9px] leading-tight opacity-80">
              <MapPin className="mt-0.5 size-2.5 shrink-0" /><span className="line-clamp-2">{event.address}</span>
            </span>
          )}
        </span>
      </m.button>
    )
  }

  const overlapButton = (summary: OverlapSummary, owner: EventOwner) => {
    if (!timeRange) return null
    const eventTop = (summary.primary.start - timeRange.firstHour * 60) * MINUTE_HEIGHT
    const eventHeight = Math.min(
      Math.max(MIN_BLOCK_PX, (summary.primary.end - summary.primary.start) * MINUTE_HEIGHT - 3),
      timeRange.height - eventTop - 2
    )
    const snappedMinute = Math.round(summary.overlapStart / 60) * 60
    const alignedTop = (snappedMinute - timeRange.firstHour * 60) * MINUTE_HEIGHT - 16
    const minimumOffset = Math.min(32, Math.max(2, eventHeight - 36))
    const maximumOffset = Math.max(minimumOffset, eventHeight - 38)
    const top = eventTop + Math.min(Math.max(alignedTop - eventTop, minimumOffset), maximumOffset)

    return (
      <Button
        key={`overlap-${summary.primary.event.id}`}
        type="button"
        variant="outline"
        size="sm"
        aria-label={`重なっている予定を表示。他${summary.events.length}件`}
        data-testid={`overlap-summary-${summary.primary.event.id}`}
        data-overlap-count={summary.events.length}
        data-owner={owner}
        onClick={() => setSelectedOverlap(summary)}
        style={{ top, right: 6, zIndex: 30 }}
        className={cn(
          "pointer-events-auto absolute h-7 min-h-7 rounded-sm border px-1 py-0.5 shadow-none hover:brightness-[0.98]",
          ownerSurfaceTone[owner]
        )}
      >
        <span className="text-xs font-semibold leading-none">他{summary.events.length}件</span>
      </Button>
    )
  }

  const editOverlapEvent = (eventId: string) => {
    preloadCalendarEditor()
    setSelectedOverlap(null)
    window.setTimeout(() => onEditEvent(eventId), reduceMotion ? 0 : 200)
  }

  const allDayButton = (event: CalendarEvent, owner: EventOwner) => (
    <Button key={event.id} type="button" variant="ghost" size="sm"
      onClick={() => onEditEvent(event.id)} onPointerEnter={preloadCalendarEditor} onPointerDown={preloadCalendarEditor} onFocus={preloadCalendarEditor}
      aria-label={event.title + "を編集"} data-calendar-event={event.id} data-owner={event.by}
      className={cn(
        "h-auto min-h-9 w-full whitespace-normal rounded-[10px] border-l-[3px] px-1.5 py-1 text-left text-[11px] font-bold leading-snug",
        ownerTone(owner)
      )}>
      <span className="block break-words text-[11px] font-bold leading-snug">{event.title}</span>
    </Button>
  )

  return (
    <div className="space-y-3" data-testid={isPaired ? "two-person-schedule" : "single-person-schedule"}>
      <div data-testid="schedule-surface" className="bg-transparent">
        {isPaired && (
          <div className={cn("grid border-b border-border/75", pairedGrid)}>
            <div aria-hidden="true" className="flex items-center justify-center text-[10px] font-medium text-muted-foreground">予定</div>
            {PEOPLE.map(person => (
              <div key={person.id} data-testid={"person-header-" + person.id}
                className="flex min-h-[53px] min-w-0 flex-col items-center justify-center gap-0.5 border-l border-border/50 px-0.5">
                <span className="flex min-w-0 items-center justify-center gap-1">
                  <OwnerAvatar owner={person.id} size="xs" decorative />
                  <span className="truncate text-[10px] font-bold">{person.label}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {hasAllDayEvents && (
          <div className={cn("grid border-b border-border/70", isPaired ? pairedGrid : soloGrid)} data-testid="all-day-strip">
            <span className="self-start pt-3 text-center text-[10px] font-semibold text-muted-foreground">終日</span>
            {isPaired ? (
              <>
                {PEOPLE.map(person => {
                  const personalEvents = eventsFor(person.id)
                  return (
                    <div key={person.id} data-testid={"all-day-" + person.id}
                      className="flex min-h-[56px] min-w-0 flex-col gap-1 border-l border-border/50 px-1 py-1.5">
                      {personalEvents.length === 0 ? (
                        <span className="m-auto text-[9px] text-muted-foreground/55">—</span>
                      ) : personalEvents.map(event => allDayButton(event, person.id))}
                    </div>
                  )
                })}
                <div data-testid="all-day-both"
                  className={cn("col-start-2 col-span-2 min-w-0 border-l border-t border-border/50 px-1 py-1.5",
                    eventsFor("both").length === 0 && "hidden")}>
                  <div className="flex flex-col gap-1">
                    {eventsFor("both").map(event => allDayButton(event, "both"))}
                  </div>
                </div>
              </>
            ) : (
              <div data-testid="all-day-self" className="flex min-h-[56px] min-w-0 flex-col gap-1 border-l border-border/50 px-1 py-1.5">
                {events.filter(event => !event.time).map(event => allDayButton(event, "A"))}
              </div>
            )}
          </div>
        )}

        {timeRange ? (
          <div data-testid="timeline-grid" className={cn("relative grid", isPaired ? pairedGrid : soloGrid)} style={{ height: timeRange.height }}>
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
            {isPaired ? (["A", "B"] as const).map(person => (
              <div key={person} data-testid={"timeline-lane-" + person}
                className="pointer-events-none relative z-[2] min-w-0 border-l border-border/50">
                {timelineLayouts[person].blocks.map(block => timedBlock(
                  block,
                  person,
                  false,
                  timelineLayouts[person].summaries.some(summary => summary.primary.event.id === block.event.id)
                ))}
                {timelineLayouts[person].summaries.map(summary => overlapButton(summary, person))}
              </div>
            )) : (
              <div data-testid="timeline-lane-self" className="pointer-events-none relative z-[2] min-w-0 border-l border-border/50">
                {timelineLayouts.solo.blocks.map(block => timedBlock(
                  block,
                  "A",
                  false,
                  timelineLayouts.solo.summaries.some(summary => summary.primary.event.id === block.event.id)
                ))}
                {timelineLayouts.solo.summaries.map(summary => overlapButton(summary, "A"))}
              </div>
            )}
            {/* This layer spans A+B, not a third narrow time column. Its blocks
                sit beneath personal appointments so both remain tappable. */}
            {isPaired && <div data-testid="timeline-lane-both"
              className="pointer-events-none absolute bottom-0 right-0 top-0 z-[1]" style={{ left: 42 }}>
              {timelineLayouts.both.blocks.map(block => timedBlock(
                block,
                "both",
                true,
                timelineLayouts.both.summaries.some(summary => summary.primary.event.id === block.event.id)
              ))}
              {timelineLayouts.both.summaries.map(summary => overlapButton(summary, "both"))}
            </div>}
          </div>
        ) : (
          <div data-testid="timeline-empty" className="flex min-h-24 flex-col items-center justify-center gap-1 px-3 py-5 text-center">
            <Clock3 className="size-4 text-muted-foreground/60" />
            <span className="text-xs text-muted-foreground">時間指定の予定はありません</span>
            <Button type="button" variant="ghost" onClick={onCreate} onPointerEnter={preloadCalendarEditor} onPointerDown={preloadCalendarEditor} onFocus={preloadCalendarEditor} className="mt-1 text-[12px] text-primary">
              <Plus className="mr-1 inline size-3.5" />予定を追加
            </Button>
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
              <m.button key={task.id} type="button" onClick={() => onEditTodo(task.id)} onPointerEnter={preloadTodoEditor} onPointerDown={preloadTodoEditor} onFocus={preloadTodoEditor}
                aria-label={task.title + "を編集"}
                initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.12 }}
                className={cn(buttonVariants({ variant: "ghost", size: "sm", className: "h-auto whitespace-normal" }), "flex min-h-[58px] w-full items-center justify-start gap-3 rounded-none border-b border-border/70 px-3 py-3 text-left last:border-0 hover:bg-accent/50")}>
                {isPaired && <OwnerAvatar owner={task.by} size="sm" decorative />}
                <span className="min-w-0 flex-1 break-words text-[12px] font-semibold">{task.title}</span>
                <span className="shrink-0 rounded-md bg-secondary px-2 py-1 text-[10px] font-semibold text-primary">TODO</span>
              </m.button>
            ))}
          </AnimatePresence>
        </section>
      )}

      <Sheet open={Boolean(selectedOverlap)} onOpenChange={open => { if (!open) setSelectedOverlap(null) }}>
        <SheetContent data-testid="overlap-sheet">
          <SheetHeader className="pr-14">
            <SheetTitle className="text-left text-[20px] font-bold">重なっている予定</SheetTitle>
            <SheetDescription className="text-left text-xs">
              {selectedOverlap?.primary.event.title}と同じ時間帯の予定です。時刻を確認して予定を選べます。
            </SheetDescription>
          </SheetHeader>
          <SheetBody className="space-y-2">
            {selectedOverlapEvents.map(block => {
              const event = block.event
              const time = `${event.time ?? "時間未定"}${event.endTime ? `–${event.endTime}` : ""}`
              const owner = event.by === "both" ? "ふたり" : event.by
              return (
                <Button
                  key={event.id}
                  type="button"
                  variant="outline"
                  aria-label={isPaired ? `${event.title}、${time}、${owner}の予定を編集` : `${event.title}、${time}の予定を編集`}
                  onClick={() => editOverlapEvent(event.id)}
                  className="h-auto min-h-[60px] w-full justify-start gap-3 whitespace-normal rounded-xl px-3 py-3 text-left"
                >
                  {isPaired && <OwnerAvatar owner={event.by} size="sm" decorative />}
                  <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
                    <span className="block w-full break-words text-[13px] font-bold leading-snug">{event.title}</span>
                    <span className="block text-[11px] font-medium text-muted-foreground">
                      {time} ・ {event.category}{event.address ? ` ・ ${event.address}` : ""}
                    </span>
                  </span>
                  {event.id === selectedOverlap?.primary.event.id && (
                    <span className="shrink-0 rounded-full bg-secondary px-2 py-1 text-[9px] font-semibold text-secondary-foreground">表示中</span>
                  )}
                </Button>
              )
            })}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  )
}
