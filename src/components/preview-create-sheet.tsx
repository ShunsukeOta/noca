import { useEffect, useState } from "react"
import { CalendarDays, NotebookPen, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetHeader, SheetBody, SheetFooter, SheetClose } from "@/components/ui/sheet"

export type PageKind = "todo" | "calendar" | "memo"
const variants = {
  todo: { title: "タスクを追加", hint: "何をする？", icon: ListChecks },
  calendar: { title: "予定を追加", hint: "どんな予定？", icon: CalendarDays },
  memo: { title: "メモを追加", hint: "タイトル", icon: NotebookPen }
}

export function PreviewCreateSheet({ open, onOpenChange, kind }: { open: boolean; onOpenChange: (next: boolean) => void; kind: PageKind }) {
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  useEffect(() => {
    if (!open) { setTitle(""); setBody("") }
  }, [open])
  const config = variants[kind]
  const Icon = config.icon
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader className="pr-14">
          <div className="sheet-leading-icon mb-3 flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></div>
          <SheetTitle className="text-left text-[22px] font-bold tracking-tight">{config.title}</SheetTitle>
          <SheetDescription className="sr-only">プレビュー画面です。入力内容は保存されません。</SheetDescription>
        </SheetHeader>
        <SheetBody>
          <Label htmlFor="preview-title" className="mb-2 text-sm">タイトル</Label>
          <Input id="preview-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder={config.hint} />
          {kind === "calendar" && (
            <>
              <Label htmlFor="preview-date" className="mb-2 mt-5 text-sm">日付</Label>
              <Input id="preview-date" type="date" />
            </>
          )}
          {kind !== "calendar" && (
            <>
              <Label htmlFor="preview-body" className="mb-2 mt-5 text-sm">{kind === "memo" ? "本文" : "メモ（任意）"}</Label>
              <Textarea id="preview-body" value={body} onChange={(event) => setBody(event.target.value)}
                rows={kind === "memo" ? 5 : 3} placeholder="ここに入力..." className="resize-none" />
            </>
          )}
        </SheetBody>
        <SheetFooter>
          <SheetClose asChild><Button type="button" className="w-full">閉じる</Button></SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
