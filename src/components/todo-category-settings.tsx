import { useEffect, useRef, useState, type FormEvent } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Check, Plus, Trash2, X } from "lucide-react"
import { Reorder, useDragControls } from "motion/react"
import type { CategoryTone, TodoCategory } from "@/app/mock-data"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { categoryTone } from "@/components/category-ui"
import { useTodos } from "@/features/todos/todo-store"
import { cn } from "@/lib/utils"

const tones: { value: CategoryTone; label: string }[] = [
  { value: "peach", label: "ピーチ" },
  { value: "green", label: "グリーン" },
  { value: "lavender", label: "ラベンダー" },
  { value: "blue", label: "ブルー" },
  { value: "mint", label: "ミント" },
  { value: "yellow", label: "イエロー" },
  { value: "rose", label: "ローズ" },
  { value: "neutral", label: "グレー" }
]
const MAX_CATEGORIES = 12
const previewTone = (tone: CategoryTone) => categoryTone("preview", [{ name: "preview", tone }])

function CategoryColorPicker({ value, onChange, label }: { value: CategoryTone; onChange: (tone: CategoryTone) => void; label: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" variant="ghost" size="icon" aria-label={`${label}の色を選択`} onClick={() => setOpen(true)}
        className="size-11 shrink-0 rounded-full">
        <span aria-hidden="true" className={cn("size-6 rounded-full border border-foreground/15", previewTone(value))} />
      </Button>
      <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-overlay/45 backdrop-blur-[2px]" />
          <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-[61] w-[calc(100%-32px)] max-w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-5 text-card-foreground shadow-2xl focus:outline-none">
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="色選択を閉じる" className="absolute right-3 top-3 size-10 rounded-full">
                <X className="size-4" />
              </Button>
            </DialogPrimitive.Close>
            <DialogPrimitive.Title className="pr-10 text-base font-bold">カテゴリの色</DialogPrimitive.Title>
            <div role="group" aria-label="色の選択肢" className="mx-auto mt-4 grid w-fit grid-cols-4 justify-items-center gap-4">
              {tones.map(tone => (
                <Button key={tone.value} type="button" variant="ghost" aria-label={tone.label} aria-pressed={value === tone.value}
                  onClick={() => { onChange(tone.value); setOpen(false) }}
                  className={cn("size-11 shrink-0 rounded-full border border-foreground/15 p-0", previewTone(tone.value), value === tone.value && "ring-2 ring-primary ring-offset-2 ring-offset-card")}>
                  {value === tone.value && <Check className="size-4" aria-hidden="true" />}
                </Button>
              ))}
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </>
  )
}

function CategoryRow({ category, canDelete, onSave, onToneChange, onDelete, onMove, onReorderCommit }: {
  category: TodoCategory
  canDelete: boolean
  onSave: (next: TodoCategory) => string | undefined
  onToneChange: (tone: CategoryTone) => void
  onDelete: (id: string) => void
  onMove: (direction: -1 | 1) => void
  onReorderCommit: () => void
}) {
  const dragControls = useDragControls()
  const [name, setName] = useState(category.name)
  const [error, setError] = useState("")
  useEffect(() => { setName(category.name); setError("") }, [category.name])

  const save = () => {
    const cleanName = name.trim()
    if (!cleanName) { setError("カテゴリ名を入力してください"); return }
    if (cleanName.length > 20) { setError("カテゴリ名は20文字以内にしてください"); return }
    if (cleanName === category.name) { setError(""); return }
    const saveError = onSave({ ...category, name: cleanName })
    setError(saveError ?? "")
  }

  return (
    <Reorder.Item value={category} dragListener={false} dragControls={dragControls} onDragEnd={onReorderCommit}
      className="border-b border-border/70 px-3 last:border-b-0" data-testid={`todo-category-${category.name}`}>
      <div className="flex min-h-[60px] items-center gap-1">
        <CategoryColorPicker value={category.tone} onChange={onToneChange} label={category.name} />
        <Input aria-label={`${category.name}のカテゴリ名`} value={name} maxLength={20} aria-invalid={Boolean(error)} onChange={event => { setName(event.target.value); setError("") }}
          onBlur={save}
          onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur() } }}
          density="compact" className="h-10 min-w-0 flex-1 px-3 text-sm" />
        <Button type="button" variant="ghost" size="icon" aria-label={`${category.name}を削除`} disabled={!canDelete}
          onClick={() => onDelete(category.id)} className="size-10 shrink-0 rounded-full text-destructive hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
        <Button type="button" variant="ghost" size="icon" aria-label={`${category.name}をドラッグして並び替え。上下キーでも移動できます`}
          onPointerDown={event => { event.preventDefault(); dragControls.start(event) }}
          onKeyDown={event => {
            if (event.key === "ArrowUp") { event.preventDefault(); onMove(-1) }
            if (event.key === "ArrowDown") { event.preventDefault(); onMove(1) }
          }}
          className="size-10 shrink-0 cursor-grab touch-none rounded-full text-muted-foreground active:cursor-grabbing">
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5" fill="none">
            <path d="M4 5h12M4 10h12M4 15h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </Button>
      </div>
      {error && <p role="alert" className="pb-2 text-xs font-medium text-destructive">{error}</p>}
    </Reorder.Item>
  )
}

export function TodoCategorySettings() {
  const { categories, todos, addCategory, updateCategory, updateCategoryTone, deleteCategory, setCategoryOrder } = useTodos()
  const [orderedCategories, setOrderedCategories] = useState(categories)
  const orderedRef = useRef(categories)
  const [newName, setNewName] = useState("")
  const [newTone, setNewTone] = useState<CategoryTone>("neutral")
  const [addError, setAddError] = useState("")
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
  const [moveToId, setMoveToId] = useState("")
  const deleteTarget = categories.find(category => category.id === deleteTargetId) ?? null
  const deleteTargetTodos = deleteTarget ? todos.filter(todo => todo.category === deleteTarget.name) : []

  useEffect(() => {
    setOrderedCategories(categories)
    orderedRef.current = categories
  }, [categories])

  const handleReorder = (next: TodoCategory[]) => {
    orderedRef.current = next
    setOrderedCategories(next)
  }
  const commitReorder = () => setCategoryOrder(orderedRef.current.map(category => category.id))
  const moveByKeyboard = (id: string, direction: -1 | 1) => {
    const index = orderedRef.current.findIndex(category => category.id === id)
    const destination = index + direction
    if (index < 0 || destination < 0 || destination >= orderedRef.current.length) return
    const next = [...orderedRef.current]
    ;[next[index], next[destination]] = [next[destination], next[index]]
    orderedRef.current = next
    setOrderedCategories(next)
    setCategoryOrder(next.map(category => category.id))
  }

  const add = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = newName.trim()
    if (!name) { setAddError("カテゴリ名を入力してください"); return }
    if (name === "すべて") { setAddError("「すべて」は予約済みの名前です"); return }
    if (name.length > 20) { setAddError("カテゴリ名は20文字以内にしてください"); return }
    if (categories.some(category => category.name === name)) { setAddError("同じ名前のカテゴリがあります"); return }
    addCategory({ name, tone: newTone })
    setNewName("")
    setAddError("")
  }

  const requestDelete = (id: string) => {
    setDeleteTargetId(id)
    setMoveToId(categories.find(item => item.id !== id)?.id ?? "")
  }
  const confirmDelete = () => {
    if (!deleteTargetId || (deleteTargetTodos.length > 0 && !moveToId)) return
    deleteCategory(deleteTargetId, deleteTargetTodos.length > 0 ? moveToId : undefined)
    setDeleteTargetId(null)
  }

  return (
    <>
      <Reorder.Group axis="y" values={orderedCategories} onReorder={handleReorder} as="ol" aria-label="TODOカテゴリ一覧" className="list-none p-0">
        {orderedCategories.map(category => (
          <CategoryRow key={category.id} category={category} canDelete={categories.length > 1}
            onSave={next => {
              if (next.name === "すべて") return "「すべて」は予約済みの名前です"
              if (next.name !== category.name && categories.some(item => item.id !== category.id && item.name === next.name)) return "同じ名前のカテゴリがあります"
              updateCategory(category.id, next)
              return undefined
            }}
            onToneChange={tone => updateCategoryTone(category.id, tone)}
            onDelete={requestDelete}
            onMove={direction => moveByKeyboard(category.id, direction)}
            onReorderCommit={commitReorder} />
        ))}
      </Reorder.Group>
      <form onSubmit={add} className="space-y-4 border-t border-border bg-background/55 px-4 py-4">
        <label htmlFor="new-todo-category" className="block text-[13px] font-semibold">カテゴリを追加</label>
        <div className="flex items-center gap-1">
          <CategoryColorPicker value={newTone} onChange={setNewTone} label="新しいカテゴリ" />
          <Input id="new-todo-category" value={newName} maxLength={20} onChange={event => setNewName(event.target.value)} placeholder="カテゴリ名" density="compact" />
          <Button type="submit" disabled={categories.length >= MAX_CATEGORIES} className="min-h-11 shrink-0 px-4">
            <Plus className="size-4" />追加
          </Button>
        </div>
        {addError && <p role="alert" className="text-xs font-medium text-destructive">{addError}</p>}
        {categories.length >= MAX_CATEGORIES && <p className="text-xs text-muted-foreground">カテゴリは最大{MAX_CATEGORIES}件です</p>}
      </form>
      <ConfirmDialog open={Boolean(deleteTarget)} onOpenChange={open => { if (!open) setDeleteTargetId(null) }}
        onConfirm={confirmDelete} title="カテゴリを削除しますか？"
        description={deleteTargetTodos.length > 0
          ? "このカテゴリのTODOは、選んだカテゴリへ移動します。"
          : "このカテゴリにTODOはありません。カテゴリを削除します。"}
        confirmLabel={deleteTargetTodos.length > 0 ? "移動して削除" : "削除する"} cancelLabel="キャンセル">
        {deleteTarget && deleteTargetTodos.length > 0 && (
          <div className="mt-4 space-y-2">
            <label htmlFor="category-delete-destination" className="text-sm font-semibold">移動先</label>
            <select id="category-delete-destination" value={moveToId} onChange={event => setMoveToId(event.target.value)}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/20">
              {categories.filter(item => item.id !== deleteTarget.id).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">対象のTODO：{deleteTargetTodos.length}件</p>
          </div>
        )}
      </ConfirmDialog>
    </>
  )
}
