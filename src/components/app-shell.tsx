import { useEffect, useState } from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Link, NavLink, useLocation, useOutlet } from "react-router-dom"
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react"
import { CalendarDays, ListTodo, NotebookPen, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PreviewCreateSheet, type PageKind } from "@/components/preview-create-sheet"
import { TodoEditorSheet } from "@/components/todo-editor-sheet"
import { CalendarEditorSheet } from "@/components/calendar-editor-sheet"
import { useCalendar } from "@/features/calendar/calendar-store"
import { useTodos } from "@/features/todos/todo-store"
import { cn } from "@/lib/utils"

const tabs: { to: string; label: string; icon: typeof ListTodo; kind: PageKind }[] = [
  { to: "/todo", label: "TODO", icon: ListTodo, kind: "todo" },
  { to: "/calendar", label: "カレンダー", icon: CalendarDays, kind: "calendar" },
  { to: "/memo", label: "メモ", icon: NotebookPen, kind: "memo" }
]

export function AppShell() {
  const location = useLocation()
  const active = tabs.find((tab) => location.pathname.startsWith(tab.to))
  const isSettings = location.pathname === "/settings"
  const reduceMotion = useReducedMotion()
  const [sheetOpen, setSheetOpen] = useState(false)
  const { editor, deleted, storageError, openCreate, closeEditor, undoDelete, dismissDeleted } = useTodos()
  const calendar = useCalendar()
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof localStorage !== "undefined" && localStorage.getItem("noca.theme") === "dark" ? "dark" : "light"
  )

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("noca.theme", theme)
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#111826" : "#f6f8fb")
  }, [theme])

  useEffect(() => { setSheetOpen(false); closeEditor(); calendar.closeEditor() }, [location.pathname, closeEditor, calendar.closeEditor])
  const page = useOutlet({ theme, onThemeChange: setTheme })

  return (
    <div className="app-shell relative">
      <header data-testid="app-header" className="app-header sticky top-0 z-40 border-b border-border/65 bg-background/95 px-5 pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex min-w-0 items-baseline gap-2">
              <span className="text-[23px] font-extrabold tracking-[-0.08em] text-primary">noca<span className="text-success">.</span></span>
              <span className="hidden rounded-full bg-secondary px-2.5 py-1 text-[10px] font-semibold tracking-[0.025em] text-secondary-foreground min-[390px]:inline-flex">ふたりのスペース</span>
            </div>
            <p className="mt-0.5 text-[12px] text-muted-foreground">{format(new Date(), "M月d日 EEEE", { locale: ja })}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="mr-1 flex -space-x-2" aria-label="2人の共有スペース（表示用）">
              <span className="flex size-8 items-center justify-center rounded-full border-[3px] border-background bg-[#d7e7ea] text-[10px] font-bold text-[#3e6470]" aria-hidden="true">A</span>
              <span className="flex size-8 items-center justify-center rounded-full border-[3px] border-background bg-[#f3dfda] text-[10px] font-bold text-[#90625a]" aria-hidden="true">B</span>
            </div>
            <Link to="/settings" state={{ from: active?.to ?? "/todo" }} aria-label="設定を開く" aria-current={isSettings ? "page" : undefined}
              className={cn("tap-target flex items-center justify-center rounded-full transition-colors", isSettings ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary")}>
              <Settings className="size-5" />
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" aria-label={isSettings ? "設定" : active?.label ?? "TODO"} className="app-content px-5 pt-5">
        <AnimatePresence initial={false} mode="wait">
          <motion.div key={location.pathname} data-page-transition={location.pathname}
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -7 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}>
            {page}
          </motion.div>
        </AnimatePresence>
      </main>

      {active && <div className="pointer-events-none fixed bottom-0 left-1/2 z-30 h-0 w-full max-w-[540px] -translate-x-1/2">
        <motion.div className="pointer-events-auto fab absolute right-5"
          whileTap={reduceMotion ? undefined : { scale: 0.91 }}
          transition={{ type: "spring", stiffness: 510, damping: 28 }}>
          <Button type="button" size="icon" aria-label={active.label + "を追加"}
            onClick={() => { if (active.kind === "todo") openCreate(); else if (active.kind === "calendar") calendar.openCreate(); else setSheetOpen(true) }}
            className="noca-shadow size-[58px] rounded-[21px] shadow-lg">
            <Plus className="size-6 stroke-[2.3px]" />
          </Button>
        </motion.div>
      </div>}

      <nav className="bottom-nav fixed bottom-0 left-1/2 z-20 flex w-full max-w-[540px] -translate-x-1/2 items-center border-t border-border/80 bg-card/95 px-5 pt-2 backdrop-blur-xl" aria-label="メインメニュー">
        <LayoutGroup id="global-bottom-tabs">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cn("flex min-h-[57px] flex-1 flex-col items-center justify-center gap-1 rounded-xl text-muted-foreground transition-colors", isActive && "text-primary")} aria-label={label}>
            {({ isActive }) => (
              <>
                <span className="relative flex h-[27px] w-[56px] items-center justify-center rounded-full">
                  {isActive && <motion.span layoutId="nav-indicator" aria-hidden="true" className="absolute inset-0 rounded-full bg-secondary"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 470, damping: 38 }} />}
                  <motion.span className="relative z-10 flex items-center justify-center"
                    animate={reduceMotion ? undefined : { scale: isActive ? 1.06 : 1, y: isActive ? -1 : 0 }}
                    transition={{ duration: 0.17 }}>
                    <Icon className="size-[21px]" strokeWidth={isActive ? 2.5 : 1.9} />
                  </motion.span>
                </span>
                <span className={cn("text-[11px] font-medium", isActive && "font-bold")}>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        </LayoutGroup>
      </nav>
      <div className="pointer-events-none fixed bottom-[calc(153px+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[540px] -translate-x-1/2 px-5">
        <AnimatePresence initial={false}>
          {deleted && (
            <motion.div key={deleted.task.id} role="status" aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
              className="pointer-events-auto flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-[13px] shadow-xl">
              <span className="font-medium">タスクを削除しました</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={undoDelete} className="tap-target px-2 font-bold text-primary">元に戻す</button>
                <button type="button" onClick={dismissDeleted} className="tap-target px-2 text-muted-foreground" aria-label="通知を閉じる">×</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div className="pointer-events-none fixed bottom-[calc(153px+env(safe-area-inset-bottom))] left-1/2 z-40 w-full max-w-[540px] -translate-x-1/2 px-5">
        <AnimatePresence initial={false}>
          {calendar.deleted && (
            <motion.div key={calendar.deleted.event.id} role="status" aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.22, ease: "easeOut" }}
              className="pointer-events-auto flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 text-[13px] shadow-xl">
              <span className="font-medium">予定を削除しました</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={calendar.undoDelete} className="tap-target px-2 font-bold text-primary">元に戻す</button>
                <button type="button" onClick={calendar.dismissDeleted} className="tap-target px-2 text-muted-foreground" aria-label="通知を閉じる">×</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      {(storageError || calendar.storageError) && (
        <div role="alert" className="fixed left-1/2 top-[calc(60px+env(safe-area-inset-top))] z-40 w-[calc(100%-40px)] max-w-[480px] -translate-x-1/2 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-white shadow-lg">
          この端末に保存できません。ブラウザの設定を確認してください。
        </div>
      )}
      {editor && <TodoEditorSheet key={editor.mode === "edit" ? editor.id : "create"} />}
      {calendar.editor && <CalendarEditorSheet key={calendar.editor.mode === "edit" ? calendar.editor.id : "create-" + calendar.editor.date} />}
      {active?.kind === "memo" && <PreviewCreateSheet kind="memo" open={sheetOpen} onOpenChange={setSheetOpen} />}
    </div>
  )
}
