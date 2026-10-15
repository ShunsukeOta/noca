import { useEffect, useRef, useState, type FormEvent } from "react"
import { CalendarDays, ChevronDown, Clock3, MapPin, NotebookPen, Trash2 } from "lucide-react"
import { type TaskCategory } from "@/app/mock-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetBody, SheetFooter } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CategorySelector } from "@/components/category-ui"
import { OwnerSelector } from "@/components/owner-ui"
import { isCalendarDate, useCalendar, type EventDraft } from "@/features/calendar/calendar-store"

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
  const [by, setBy] = useState<"A" | "B" | "both">(original?.by ?? "A")
  const [address, setAddress] = useState(original?.address ?? "")
  const [memo, setMemo] = useState(original?.memo ?? "")
  const [error, setError] = useState("")
  const [discardOpen, setDiscardOpen] = useState(false)
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
    if (hasChanges) { setDiscardOpen(true); return }
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
            <Label htmlFor="event-title" className="mb-2">
              タイトル <span className="text-destructive">*</span>
            </Label>
            <Input id="event-title" maxLength={200} value={title} onChange={event => setTitle(event.target.value)}
              placeholder="予定のタイトル" aria-invalid={!!error && !title.trim()}
            />

            <div className="mt-5">
              <p className="mb-2 text-[13px] font-semibold">誰の予定？</p>
              <OwnerSelector value={by} onChange={setBy} />
            </div>

            <div className="mt-6 flex items-center gap-2 text-primary">
              <CalendarDays className="size-[17px]" /><Label htmlFor="event-date">日付</Label>
            </div>
            <Input id="event-date" type="date" required value={date} onChange={event => setDate(event.target.value)} className="mt-2 appearance-none" />

            <div className="mt-6 flex items-center justify-between gap-4">
              <span className="flex items-center gap-2 text-[13px] font-semibold"><Clock3 className="size-[17px] text-primary" />終日</span>
              <Switch aria-label="終日" checked={allDay} onCheckedChange={setAllDay} />
            </div>
            {!allDay && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <Label htmlFor="event-start" className="mb-2">開始時間</Label>
                  <Input id="event-start" type="time" required value={time} onChange={event => setTime(event.target.value)} className="px-3" />
                </div>
                <div className="min-w-0">
                  <Label htmlFor="event-end" className="mb-2">終了時間（任意）</Label>
                  <Input id="event-end" type="time" value={endTime} onChange={event => setEndTime(event.target.value)} className="px-3" />
                </div>
              </div>
            )}

            <details ref={detailsRef}
              className="group mt-6 rounded-lg border border-border bg-background/65 px-4 py-1">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                詳細を追加（任意）<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border pb-4 pt-4">
                <div>
                  <Label id="event-category-label" className="mb-2 text-xs">カテゴリ</Label>
                  <CategorySelector aria-labelledby="event-category-label" value={category} onChange={setCategory} />
                </div>
                <div>
                  <Label htmlFor="event-address" className="mb-2 flex items-center gap-2 text-xs"><MapPin className="size-4" />場所</Label>
                  <Input id="event-address" density="compact" value={address} maxLength={500} onChange={event => setAddress(event.target.value)} placeholder="場所・待ち合わせ先" className="bg-card" />
                </div>
                <div>
                  <Label htmlFor="event-memo" className="mb-2 flex items-center gap-2 text-xs"><NotebookPen className="size-4" />メモ</Label>
                  <Textarea id="event-memo" rows={3} maxLength={5000} value={memo} onChange={event => setMemo(event.target.value)} placeholder="補足したいこと" className="bg-card" />
                </div>
              </div>
            </details>

            {error && <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">{error}</p>}

            {editor?.mode === "edit" && (
              <Button type="button" variant="ghost" onClick={remove} className="mt-6 min-h-11 justify-start px-0 text-[13px] text-destructive hover:bg-transparent hover:underline">
                <Trash2 className="size-4" />この予定を削除
              </Button>
            )}
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="h-12 w-full">
              {editor?.mode === "edit" ? "変更を保存" : "予定を追加"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onConfirm={closeEditor}
        title="入力内容を破棄しますか？"
        description="保存していない変更は失われます。"
        confirmLabel="破棄する"
        cancelLabel="編集を続ける"
      />
    </Sheet>
  )
}
