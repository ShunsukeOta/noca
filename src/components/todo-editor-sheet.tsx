import { useEffect, useState, type FormEvent } from "react"
import { CalendarDays, ChevronDown, Link2, MapPin, NotebookPen, Trash2 } from "lucide-react"
import { type TaskCategory } from "@/app/mock-data"
import { useTodos, type TodoDraft } from "@/features/todos/todo-store"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const categories: TaskCategory[] = ["その他", "暮らし", "おでかけ", "ふたり"]

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
    if (dirty && !window.confirm("入力内容を破棄しますか？")) return
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
            <label htmlFor="todo-title" className="mb-2 block text-[13px] font-semibold">やること <span className="text-destructive">*</span></label>
            <input id="todo-title" value={title} onChange={event => setTitle(event.target.value)}
              maxLength={200} placeholder="例：週末の買い出し"
              aria-invalid={Boolean(error && !title.trim())}
              className="h-12 w-full rounded-[13px] border border-input bg-background px-4 text-base text-foreground outline-none transition-shadow placeholder:text-muted-foreground/75 focus:border-ring focus:ring-[3px] focus:ring-ring/20" />

            <div className="mt-6 flex items-center gap-2 text-primary"><CalendarDays className="size-[17px]" /><h3 className="text-[13px] font-semibold">期限</h3></div>
            <input id="todo-date" aria-label="期限" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)}
              className="mt-2 h-12 w-full min-w-0 appearance-none rounded-[13px] border border-input bg-background px-4 text-base text-foreground outline-none focus:border-ring focus:ring-[3px] focus:ring-ring/20" />
            {dueDate && <button type="button" onClick={() => setDueDate("")} className="mt-2 min-h-9 text-xs font-semibold text-muted-foreground underline-offset-4 hover:underline">期限を解除</button>}

            <h3 className="mb-3 mt-6 text-[13px] font-semibold">カテゴリ</h3>
            <div className="flex flex-wrap gap-2" role="group" aria-label="カテゴリ">
              {categories.map(option => (
                <button type="button" key={option} aria-pressed={category === option} onClick={() => setCategory(option)}
                  className={cn("min-h-11 rounded-full border px-4 text-[13px] font-semibold transition-colors", category === option ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground")}>
                  {option}
                </button>
              ))}
            </div>

            <details className="group mt-6 rounded-[15px] border border-border bg-background/65 px-4 py-1" open={Boolean(original?.memo || original?.url || original?.address) || undefined}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                詳細を追加（任意）<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border pb-4 pt-4">
                <div>
                  <label htmlFor="todo-memo" className="mb-2 flex items-center gap-2 text-xs font-semibold"><NotebookPen className="size-4" />メモ</label>
                  <textarea id="todo-memo" rows={3} maxLength={5000} value={memo} onChange={event => setMemo(event.target.value)}
                    className="w-full resize-y rounded-xl border border-input bg-card px-3 py-3 text-base outline-none focus:border-ring" placeholder="補足したいこと" />
                </div>
                <div>
                  <label htmlFor="todo-url" className="mb-2 flex items-center gap-2 text-xs font-semibold"><Link2 className="size-4" />URL</label>
                  <input id="todo-url" inputMode="url" type="url" value={url} onChange={event => setUrl(event.target.value)}
                    placeholder="https://..." className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus:border-ring" />
                </div>
                <div>
                  <label htmlFor="todo-address" className="mb-2 flex items-center gap-2 text-xs font-semibold"><MapPin className="size-4" />場所</label>
                  <input id="todo-address" value={address} onChange={event => setAddress(event.target.value)}
                    placeholder="住所や待ち合わせ場所" className="h-11 w-full rounded-xl border border-input bg-card px-3 text-base outline-none focus:border-ring" />
                </div>
              </div>
            </details>
            {error && <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">{error}</p>}
            {editor?.mode === "edit" && (
              <button type="button" onClick={handleDelete} className="mt-6 inline-flex min-h-11 items-center gap-2 text-[13px] font-semibold text-destructive">
                <Trash2 className="size-4" />このタスクを削除
              </button>
            )}
          </SheetBody>
          <SheetFooter>
            <Button type="submit" className="h-12 w-full rounded-[14px]">
              {editor?.mode === "edit" ? "変更を保存" : "タスクを追加"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
