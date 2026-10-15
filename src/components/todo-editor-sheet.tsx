import { useEffect, useState, type FormEvent } from "react"
import { CalendarDays, ChevronDown, Link2, MapPin, NotebookPen, Trash2 } from "lucide-react"
import { type TaskCategory } from "@/app/mock-data"
import { useTodos, type TodoDraft } from "@/features/todos/todo-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { CategorySelector } from "@/components/category-ui"

export function TodoEditorSheet() {
  const { todos, editor, closeEditor, addTodo, updateTodo, deleteTodo } = useTodos()
  const original = editor?.mode === "edit" ? todos.find(todo => todo.id === editor.id) : undefined
  const [title, setTitle] = useState(original?.title ?? "")
  const [dueDate, setDueDate] = useState(original?.dueDate ?? "")
  const [category, setCategory] = useState<TaskCategory>(original?.category ?? "その他")
  const [memo, setMemo] = useState(original?.memo ?? "")
  const [url, setUrl] = useState(original?.url ?? "")
  const [address, setAddress] = useState(original?.address ?? "")
  const [error, setError] = useState("")
  const [discardOpen, setDiscardOpen] = useState(false)

  // A new sheet component is mounted per create/edit session, so draft state is isolated.
  const previous: TodoDraft = {
    title: original?.title ?? "",
    category: original?.category ?? "その他",
    dueDate: original?.dueDate,
    memo: original?.memo,
    url: original?.url,
    address: original?.address
  }
  const dirty = title !== previous.title ||
    dueDate !== (previous.dueDate ?? "") || category !== previous.category ||
    memo !== (previous.memo ?? "") || url !== (previous.url ?? "") || address !== (previous.address ?? "")

  useEffect(() => setError(""), [title, url])

  const close = () => {
    if (dirty) { setDiscardOpen(true); return }
    closeEditor()
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const cleanTitle = title.trim()
    if (!cleanTitle) { setError("タイトルを入力してください"); return }
    const cleanUrl = url.trim()
    if (cleanUrl) {
      try {
        const parsed = new URL(cleanUrl)
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("unsupported protocol")
      } catch {
        setError("URLは http:// または https:// で入力してください")
        return
      }
    }
    const draft: TodoDraft = {
      title: cleanTitle, category,
      dueDate: dueDate || undefined,
      memo: memo.trim() || undefined,
      url: cleanUrl || undefined,
      address: address.trim() || undefined
    }
    if (editor?.mode === "edit") updateTodo(editor.id, draft)
    else addTodo(draft)
    closeEditor()
  }

  const handleDelete = () => {
    if (editor?.mode !== "edit") return
    deleteTodo(editor.id)
    closeEditor()
  }

  return (
    <Sheet open onOpenChange={(next) => { if (!next) close() }}>
      <SheetContent onEscapeKeyDown={(event) => { if (dirty) { event.preventDefault(); close() } }}>
        <SheetHeader className="pr-14">
          <div className="sheet-leading-icon mb-2 flex size-11 items-center justify-center rounded-2xl bg-secondary text-primary">
            <NotebookPen className="size-5" />
          </div>
          <SheetTitle className="text-left text-[22px] font-bold tracking-tight">{editor?.mode === "edit" ? "タスクを編集" : "タスクを追加"}</SheetTitle>
          <SheetDescription className="sr-only">タスクのタイトルや期限、カテゴリを設定します。</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <SheetBody>
            <Label htmlFor="todo-title" className="mb-2">やること <span className="text-destructive">*</span></Label>
            <Input id="todo-title" value={title} onChange={event => setTitle(event.target.value)}
              maxLength={200} placeholder="例：週末の買い出し"
              aria-invalid={Boolean(error && !title.trim())}
            />

            <div className="mt-6 flex items-center gap-2 text-primary"><CalendarDays className="size-[17px]" /><h3 className="text-[13px] font-semibold">期限</h3></div>
            <Input id="todo-date" aria-label="期限" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="mt-2 appearance-none" />
            {dueDate && <Button type="button" variant="link" onClick={() => setDueDate("")} className="mt-2 min-h-11 px-0 text-xs font-semibold text-muted-foreground">期限を解除</Button>}

            <h3 className="mb-3 mt-6 text-[13px] font-semibold">カテゴリ</h3>
            <CategorySelector value={category} onChange={setCategory} />

            <details className="group mt-6 rounded-lg border border-border bg-background/65 px-4 py-1" open={Boolean(original?.memo || original?.url || original?.address) || undefined}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                詳細を追加（任意）<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border pb-4 pt-4">
                <div>
                  <Label htmlFor="todo-memo" className="mb-2 flex items-center gap-2 text-xs"><NotebookPen className="size-4" />メモ</Label>
                  <Textarea id="todo-memo" rows={3} maxLength={5000} value={memo} onChange={event => setMemo(event.target.value)} placeholder="補足したいこと" className="bg-card" />
                </div>
                <div>
                  <Label htmlFor="todo-url" className="mb-2 flex items-center gap-2 text-xs"><Link2 className="size-4" />URL</Label>
                  <Input id="todo-url" density="compact" inputMode="url" type="url" value={url} onChange={event => setUrl(event.target.value)} placeholder="https://..." className="bg-card" />
                </div>
                <div>
                  <Label htmlFor="todo-address" className="mb-2 flex items-center gap-2 text-xs"><MapPin className="size-4" />場所</Label>
                  <Input id="todo-address" density="compact" value={address} onChange={event => setAddress(event.target.value)} placeholder="住所や待ち合わせ場所" className="bg-card" />
                </div>
              </div>
            </details>
            {error && <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">{error}</p>}
            {editor?.mode === "edit" && (
              <Button type="button" variant="ghost" onClick={handleDelete} className="mt-6 min-h-11 justify-start px-0 text-[13px] text-destructive hover:bg-transparent hover:underline">
                <Trash2 className="size-4" />このタスクを削除
              </Button>
            )}
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="h-12 w-full">
              {editor?.mode === "edit" ? "変更を保存" : "タスクを追加"}
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
