import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { NavLink, Outlet, useLocation } from "react-router-dom"
import { CalendarDays, ListTodo, NotebookPen, Moon, Plus, Sun } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PreviewCreateSheet, type PageKind } from "@/components/preview-create-sheet"
import { TodoEditorSheet } from "@/components/todo-editor-sheet"
import { useTodos } from "@/features/todos/todo-store"
import { cn } from "@/lib/utils"

const tabs: { to: string; label: string; icon: typeof ListTodo; kind: PageKind }[] = [
  { to: "/todo", label: "TODO", icon: ListTodo, kind: "todo" },
  { to: "/calendar", label: "カレンダー", icon: CalendarDays, kind: "calendar" },
  { to: "/memo", label: "メモ", icon: NotebookPen, kind: "memo" }
]

export function AppShell() {
  const location = useLocation()
  const active = tabs.find((tab) => location.pathname.startsWith(tab.to)) ?? tabs[0]
  const [sheetOpen, setSheetOpen] = useState(false)
  const { editor, deleted, storageError, openCreate, closeEditor, undoDelete, dismissDeleted } = useTodos()
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof localStorage !== "undefined" && localStorage.getItem("noca.theme") === "dark" ? "dark" : "light"
  )

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("noca.theme", theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111826" : "#f6f8fb")
  }, [theme])

  useEffect(() => { setSheetOpen(false); closeEditor() }, [location.pathname, closeEditor])

  return (
    <div className="app-shell relative">
      <header className="app-header relative px-5 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[23px] font-extrabold tracking-[-0.08em] text-primary">noca<span className="text-success">.</span></span>
              <span className="rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold tracking-[0.025em] text-secondary-foreground">ふたりのスペース</span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{format(new Date(), "M月d日 EEEE", { locale: ja })}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2" aria-label="2人の共有スペース（表示用）">
              <span className="flex size-8 items-center justify-center rounded-full border-[3px] border-background bg-[#d7e7ea] text-[10px] font-bold text-[#3e6470]" aria-hidden="true">A</span>
              <span className="flex size-8 items-center justify-center rounded-full border-[3px] border-background bg-[#f3dfda] text-[10px] font-bold text-[#90625a]" aria-hidden="true">B</span>
            </div>
            <button type="button" className="tap-target ml-1 flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
              aria-label={theme === "dark" ? "ライトモードに切り替え" : "ダークモードに切り替え"}
              onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}>
              {theme === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
            </button>
          </div>
        </div>
      </header>

      <main id="main-content" aria-label={active.label} className="app-content px-5 pt-5">
        <Outlet />
      </main>

      <div className="pointer-events-none fixed bottom-0 left-1/2 z-30 h-0 w-full max-w-[540px] -translate-x-1/2">
        <div className="pointer-events-auto fab absolute right-5">
          <Button type="button" size="icon" aria-label={active.label + "を追加"}
            onClick={() => active.kind === "todo" ? openCreate() : setSheetOpen(true)}
            className="noca-shadow size-[58px] rounded-[21px] shadow-lg active:scale-95">
            <Plus className="size-6 stroke-[2.3px]" />
          </Button>
        </div>
      </div>

      <nav className="bottom-nav fixed bottom-0 left-1/2 z-20 flex w-full max-w-[540px] -translate-x-1/2 items-center border-t border-border/80 bg-card/95 px-5 pt-2 backdrop-blur-xl" aria-label="メインメニュー">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cn("flex min-h-[57px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors", isActive && "text-primary")} aria-label={label}>
            {({ isActive }) => (
              <>
                <span className={cn("flex h-[27px] w-[56px] items-center justify-center rounded-full transition-colors", isActive && "bg-secondary")}>
                  <Icon className="size-[21px]" strokeWidth={isActive ? 2.5 : 1.9} />
                </span>
                <span className={cn("text-[11px] font-medium", isActive && "font-bold")}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {deleted && (
        <div className="pointer-events-none fixed bottom-[calc(153px+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[540px] -translate-x-1/2 px-5">
          <div role="status" aria-live="polite" className="pointer-events-auto flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-[13px] shadow-xl">
            <span className="font-medium">タスクを削除しました</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={undoDelete} className="tap-target px-2 font-bold text-primary">元に戻す</button>
              <button type="button" onClick={dismissDeleted} className="tap-target px-2 text-muted-foreground" aria-label="通知を閉じる">×</button>
            </div>
          </div>
        </div>
      )}
      {storageError && (
        <div role="alert" className="fixed left-1/2 top-[calc(60px+env(safe-area-inset-top))] z-40 w-[calc(100%-40px)] max-w-[480px] -translate-x-1/2 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-white shadow-lg">
          この端末に保存できません。ブラウザの設定を確認してください。
        </div>
      )}
      {editor && <TodoEditorSheet key={editor.mode === "edit" ? editor.id : "create"} />}
      {active.kind !== "todo" && <PreviewCreateSheet kind={active.kind} open={sheetOpen} onOpenChange={setSheetOpen} />}
    </div>
  )
}
