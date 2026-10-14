import { useEffect, useRef, useState, type FormEvent } from "react"
import { CalendarDays, ChevronDown, Clock3, MapPin, NotebookPen, Trash2 } from "lucide-react"
import { type TaskCategory } from "@/app/mock-data"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet"
import { isCalendarDate, useCalendar, type EventDraft } from "@/features/calendar/calendar-store"
import { cn } from "@/lib/utils"

const categories: TaskCategory[] = ["その他", "暮らし", "おでかけ", "ふたり"]

export function CalendarEditorSheet() {
  const { events, editor, closeEditor, addEvent, updateEvent, deleteEvent } = useCalendar()
  const original = editor?.mode === "edit" ? events.find(event => event.id === editor.id) : undefined
  const initialDate = editor?.mode === "create" ? editor.date : original?.date ?? ""
  const [title, setTitle] = useState(original?.title ?? "")
  const [date, setDate] = useState(initialDate)
  const [allDay, setAllDay] = useState(!original?.time)
  const [time, setTime] = useState(original?.time ?? "09:00")
  const [endTime, setEndTime] = useState(original?.endTime ?? "")
  const [category, setCategory] = useState<TaskCategory>(original?.category ?? "その他")
  const [by, setBy] = useState<"A" | "B">(original?.by ?? "A")
  const [address, setAddress] = useState(original?.address ?? "")
  const [memo, setMemo] = useState(original?.memo ?? "")
  const [error, setError] = useState("")
  const detailsRef = useRef<HTMLDetailsElement>(null)

  const hasChanges = title !== (original?.title ?? "") ||
    date !== initialDate || allDay !== !original?.time ||
    (!allDay && time !== (original?.time ?? "09:00")) ||
    (!allDay && endTime !== (original?.endTime ?? "")) ||
    category !== (original?.category ?? "その他") || by !== (original?.by ?? "A") ||
    address !== (original?.address ?? "") || memo !== (original?.memo ?? "")

  useEffect(() => setError(""), [title, date, time, endTime, allDay])
  useEffect(() => { if (detailsRef.current && (original?.address || original?.memo)) detailsRef.current.open = true }, [])

  const close = () => {
    if (hasChanges && !window.confirm("入力内容を破棄しますか？")) return
    closeEditor()
  }

  const save = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!title.trim()) { setError("タイトルを入力してください"); return }
    if (!isCalendarDate(date)) { setError("正しい日付を指定してください"); return }
    if (!allDay && (!time || (endTime && endTime <= time))) {
      setError(!time ? "開始時間を入力してください" : "終了時間は開始時間より後にしてください")
      return
    }
    const draft: EventDraft = {
      title: title.trim(),
      date, category, by,
      time: allDay ? undefined : time,
      endTime: allDay ? undefined : endTime || undefined,
      address: address.trim() || undefined,
      memo: memo.trim() || undefined
    }
    if (editor?.mode === "edit") updateEvent(editor.id, draft)
    else addEvent(draft)
    closeEditor()
  }

  const remove = () => {
    if (editor?.mode !== "edit") return
    deleteEvent(editor.id)
    closeEditor()
  }

  return (
    <Sheet open onOpenChange={next => { if (!next) close() }}>
      <SheetContent onEscapeKeyDown={event => { if (hasChanges) { event.preventDefault(); close() } }}>
        <SheetHeader className="pr-14">
          <div className="sheet-leading-icon mb-2 flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
            <CalendarDays className="size-5" />
          </div>
          <SheetTitle className="text-left text-[22px] font-bold tracking-tight">
            {editor?.mode === "edit" ? "予定を編集" : "予定を追加"}
          </SheetTitle>
          <SheetDescription className="sr-only">予定のタイトル・日付・時間などを入力します。</SheetDescription>
        </SheetHeader>
        <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
          <SheetBody>
            <label htmlFor="event-title" className="mb-2 block text-[13px] font-semibold">
              タイトル <span className="text-destructive">*</span>
            </label>
            <input id="event-title" maxLength={200} value={title} onChange={event => setTitle(event.target.value)}
              placeholder="予定のタイトル" aria-invalid={!!error && !title.trim()}
              className="h-12 w-full rounded-[13px] border border-input bg-background px-4 text-base text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/20" />

            <div className="mt-5">
              <p className="mb-2 text-[13px] font-semibold">誰の予定？</p>
              <div role="group" aria-label="予定の担当" className="grid grid-cols-2 gap-2">
                {(["A", "B"] as const).map(person => (
                  <button key={person} type="button" aria-pressed={by === person} onClick={() => setBy(person)}
                    className={cn("flex min-h-11 items-center justify-center gap-2 rounded-[12px] border px-3 text-[13px] font-semibold transition-colors",
                      by === person
                        ? person === "A" ? "border-[#73a2a4] bg-[#e5f1ef] text-[#356d6a] dark:bg-[#244145] dark:text-[#a2d7d5]" : "border-[#d59677] bg-[#faeee8] text-[#9a6654] dark:bg-[#48332f] dark:text-[#f3cbb9]"
                        : "border-border bg-card text-muted-foreground")}>
                    <span className={cn("flex size-6 items-center justify-center rounded-full text-[10px] font-bold",
                      person === "A" ? "bg-[#d7e7ea] text-[#3e6470]" : "bg-[#f3dfda] text-[#90625a]")}>{person}</span>
                    {person}の予定
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex items-center gap-2 text-primary">
              <CalendarDays className="size-[17px]" /><label htmlFor="event-date" className="text-[13px] font-semibold">日付</label>
            </div>
            <input id="event-date" type="date" required value={date} onChange={event => setDate(event.target.value)}
              className="mt-2 h-12 w-full min-w-0 appearance-none rounded-[13px] border border-input bg-background px-4 text-base text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/20" />

            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><Clock3 className="size-[17px] text-primary" />終日</span>
              <button type="button" role="switch" aria-label="終日" aria-checked={allDay}
                onClick={() => setAllDay(value => !value)}
                className={cn("relative h-8 w-14 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", allDay ? "bg-primary" : "bg-muted-foreground/35")}>
                <span className={cn("absolute left-0 top-1 size-6 rounded-full bg-white shadow-sm transition-transform", allDay ? "translate-x-[25px]" : "translate-x-[4px]")} />
              </button>
            </div>
            {!allDay && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label htmlFor="event-start" className="mb-2 block text-[13px] font-semibold">開始時間</label>
                  <input id="event-start" type="time" required value={time} onChange={event => setTime(event.target.value)}
                    className="h-12 w-full min-w-0 appearance-none rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus:border-ring" />
                </div>
                <div className="min-w-0">
                  <label htmlFor="event-end" className="mb-2 block text-[13px] font-semibold">終了時間（任意）</label>
                  <input id="event-end" type="time" value={endTime} onChange={event => setEndTime(event.target.value)}
                    className="h-12 w-full min-w-0 appearance-none rounded-xl border border-input bg-background px-3 text-base text-foreground outline-none focus:border-ring" />
                </div>
              </div>
            )}

            <details ref={detailsRef}
              className="group mt-6 rounded-[15px] border border-border bg-background/65 px-4 py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                詳細を追加（任意）<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border pb-4 pt-4">
                <div>
                  <label htmlFor="event-category" className="mb-2 block text-xs font-semibold">カテゴリ</label>
                  <div id="event-category" role="group" aria-label="予定のカテゴリ" className="flex flex-wrap gap-2">
                    {categories.map(option => (
                      <button type="button" key={option} aria-pressed={category === option} onClick={() => setCategory(option)}
                        className={cn("min-h-11 rounded-full border px-4 text-[13px] font-semibold", category === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label htmlFor="event-address" className="mb-2 flex items-center gap-2 text-xs font-semibold"><MapPin className="size-4" />場所</label>
                  <input id="event-address" value={address} maxLength={500} onChange={event => setAddress(event.target.value)}
                    placeholder="場所・待ち合わせ先" className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus:border-ring" />
                </div>
                <div>
                  <label htmlFor="event-memo" className="mb-2 flex items-center gap-2 text-xs font-semibold"><NotebookPen className="size-4" />メモ</label>
                  <textarea id="event-memo" rows={3} maxLength={5000} value={memo} onChange={event => setMemo(event.target.value)}
                    placeholder="補足したいこと" className="w-full resize-y rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:border-ring" />
                </div>
              </div>
            </details>

            {error && <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">{error}</p>}

            {editor?.mode === "edit" && (
              <button type="button" onClick={remove} className="mt-6 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-destructive">
                <Trash2 className="size-4" />この予定を削除
              </button>
            )}
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="h-12 w-full rounded-[14px]">
              {editor?.mode === "edit" ? "変更を保存" : "予定を追加"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
