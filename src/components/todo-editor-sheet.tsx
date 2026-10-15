import { useEffect, useRef, useState, type FormEvent } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { CalendarDays, Check, ChevronDown, Link2, MapPin, NotebookPen, Trash2 } from "lucide-react"
import { type TaskCategory } from "@/app/mock-data"
import { useTodos, type TodoDraft } from "@/features/todos/todo-store"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Sheet, SheetContent, SheetTitle, SheetDescription, SheetHeader, SheetBody, SheetFooter } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { TodoCategorySelector } from "@/components/category-ui"

export function TodoEditorSheet() {
  const { todos, categories, editor, closeEditor, addTodo, updateTodo, deleteTodo } = useTodos()
  const original = editor?.mode === "edit" ? todos.find(todo => todo.id === editor.id) : undefined
  const defaultCategory = categories.find(item => item.name === "その他")?.name ?? categories[0]?.name ?? ""
  const [title, setTitle] = useState(original?.title ?? "")
  const [dueDate, setDueDate] = useState(original?.dueDate ?? "")
  const [category, setCategory] = useState<TaskCategory>(original?.category ?? defaultCategory)
  const [savedCategory, setSavedCategory] = useState<TaskCategory>(original?.category ?? defaultCategory)
  const [memo, setMemo] = useState(original?.memo ?? "")
  const [url, setUrl] = useState(original?.url ?? "")
  const [address, setAddress] = useState(original?.address ?? "")
  const [error, setError] = useState("")
  const [showSavedCheck, setShowSavedCheck] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const flashTimeoutRef = useRef<number | null>(null)
  const reduceMotion = useReducedMotion()

  // A new sheet component is mounted per create/edit session, so draft state is isolated.
  const previous: TodoDraft = {
    title: original?.title ?? "",
    category: original?.category ?? savedCategory,
    dueDate: original?.dueDate,
    memo: original?.memo,
    url: original?.url,
    address: original?.address
  }
  const dirty = title !== previous.title ||
    dueDate !== (previous.dueDate ?? "") || category !== previous.category ||
    memo !== (previous.memo ?? "") || url !== (previous.url ?? "") || address !== (previous.address ?? "")

  useEffect(() => setError(""), [title, url])
  useEffect(() => () => {
    if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current)
  }, [])

  const buildDraft = (): TodoDraft | null => {
    const cleanTitle = title.trim()
    if (!cleanTitle) { setError("タイトルを入力してください"); return null }
    const cleanUrl = url.trim()
    if (cleanUrl) {
      try {
        const parsed = new URL(cleanUrl)
        if (!["https:", "http:"].includes(parsed.protocol)) throw new Error("unsupported protocol")
      } catch {
        setError("URLは http:// または https:// で入力してください")
        return null
      }
    }

    return {
      title: cleanTitle, category,
      dueDate: dueDate || undefined,
      memo: memo.trim() || undefined,
      url: cleanUrl || undefined,
      address: address.trim() || undefined
    }
  }

  const close = () => {
    if (dirty) {
      const draft = buildDraft()
      if (!draft) return
      if (editor?.mode === "edit") updateTodo(editor.id, draft)
      else addTodo(draft)
    }
    closeEditor()
  }

  const handleSave = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const draft = buildDraft()
    if (!draft) return
    if (editor?.mode === "edit") {
      updateTodo(editor.id, draft)
      closeEditor()
      return
    }

    addTodo(draft)
    if (flashTimeoutRef.current !== null) window.clearTimeout(flashTimeoutRef.current)
    setShowSavedCheck(true)
    flashTimeoutRef.current = window.setTimeout(() => {
      setShowSavedCheck(false)
      flashTimeoutRef.current = null
    }, 1400)
    setSavedCategory(category)
    setTitle("")
    setDueDate("")
    setMemo("")
    setUrl("")
    setAddress("")
    setError("")
    if (detailsRef.current) detailsRef.current.open = false
    window.requestAnimationFrame(() => titleInputRef.current?.focus({ preventScroll: true }))
  }

  const handleDelete = () => {
    if (editor?.mode !== "edit") return
    deleteTodo(editor.id)
    closeEditor()
  }

  return (
    <Sheet open onOpenChange={(next) => { if (!next) close() }}>
      <SheetContent>
        <SheetHeader className="sr-only">
          <SheetTitle>{editor?.mode === "edit" ? "タスクを編集" : "タスクを追加"}</SheetTitle>
          <SheetDescription className="sr-only">タスクのタイトルや期限、カテゴリを設定します。</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <SheetBody className="pt-6">
            <Label htmlFor="todo-title" className="sr-only">やること</Label>
            <div className="relative">
              <Input ref={titleInputRef} id="todo-title" value={title} onChange={event => setTitle(event.target.value)}
                maxLength={200} placeholder="例：週末の買い出し"
                aria-invalid={Boolean(error && !title.trim())}
                className="pr-11"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 size-[18px] -translate-y-1/2">
                <AnimatePresence>
                  {showSavedCheck && <motion.span role="status" aria-live="polite"
                    initial={reduceMotion ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.85 }}
                    transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
                    className="flex size-full items-center justify-center rounded-full border border-emerald-600 bg-emerald-600 text-white">
                    <Check className="size-2.5" strokeWidth={2.5} aria-hidden="true" />
                    <span className="sr-only">タスクを追加しました</span>
                  </motion.span>}
                </AnimatePresence>
              </span>
            </div>

            <TodoCategorySelector aria-label="カテゴリ" value={category} onChange={setCategory} categories={categories} className="mt-6" />

            <details ref={detailsRef} className="group mt-6 rounded-lg border border-border bg-background/65 px-4 py-1" open={Boolean(original?.dueDate || original?.memo || original?.url || original?.address) || undefined}>
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between text-[13px] font-semibold [&::-webkit-details-marker]:hidden">
                詳細を入力<ChevronDown className="size-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <div className="space-y-4 border-t border-border pb-4 pt-4">
                <div>
                  <div className="mb-2 flex items-center gap-2 text-primary"><CalendarDays className="size-4" /><Label htmlFor="todo-date" className="text-xs">期限</Label></div>
                  <Input id="todo-date" aria-label="期限" type="date" value={dueDate} onChange={event => setDueDate(event.target.value)} className="appearance-none bg-card" />
                  {dueDate && <Button type="button" variant="link" onClick={() => setDueDate("")} className="mt-1 min-h-11 px-0 text-xs font-semibold text-muted-foreground">期限を解除</Button>}
                </div>
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
    </Sheet>
  )
}
