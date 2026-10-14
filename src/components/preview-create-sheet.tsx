import { useEffect, useState } from "react"
import { CalendarDays, NotebookPen, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
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
          <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="size-5" /></div>
          <SheetTitle className="text-left text-[22px] font-bold tracking-tight">{config.title}</SheetTitle>
          <SheetDescription className="mt-1 text-left text-sm leading-relaxed text-muted-foreground">
            UI確認用の入力シートです。保存機能は次のフェーズで実装します。
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <label htmlFor="preview-title" className="mb-2 block text-sm font-semibold">タイトル</label>
          <input id="preview-title" value={title} onChange={(event) => setTitle(event.target.value)}
            placeholder={config.hint} className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
          {kind === "calendar" && (
            <>
              <label htmlFor="preview-date" className="mb-2 mt-5 block text-sm font-semibold">日付</label>
              <input id="preview-date" type="date" className="h-12 w-full rounded-xl border border-input bg-background px-4 text-base text-foreground" />
            </>
          )}
          {kind !== "calendar" && (
            <>
              <label htmlFor="preview-body" className="mb-2 mt-5 block text-sm font-semibold">{kind === "memo" ? "本文" : "メモ（任意）"}</label>
              <textarea id="preview-body" value={body} onChange={(event) => setBody(event.target.value)}
                rows={kind === "memo" ? 5 : 3} placeholder="ここに入力..." className="w-full resize-none rounded-xl border border-input bg-background px-4 py-3 text-base text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/20" />
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
