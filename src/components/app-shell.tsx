import { lazy, Suspense, useEffect, useState } from "react"
import { format } from "date-fns"
import { ja } from "date-fns/locale"
import { Link, NavLink, useLocation, useOutlet } from "react-router-dom"
import { AnimatePresence, LayoutGroup, m, useReducedMotion } from "motion/react"
import { CalendarDays, ListTodo, NotebookPen, Plus, Settings, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ChunkLoadBoundary } from "@/components/chunk-load-boundary"
import { OwnerAvatar } from "@/components/owner-ui"
import { UndoToast } from "@/components/undo-toast"
import { loadCalendarEditor, loadTodoEditor, preloadCalendarEditor, preloadTodoEditor } from "@/components/editor-loaders"
import { preloadTodoCategorySettings } from "@/components/settings-loaders"
import { useCalendar } from "@/features/calendar/calendar-store"
import { useTodos } from "@/features/todos/todo-store"
import { useWorkspaceMembership } from "@/features/workspace/workspace-membership"
import { cn } from "@/lib/utils"

type PageKind = "todo" | "calendar" | "memo"
const tabs: { to: string; label: string; icon: typeof ListTodo; kind: PageKind }[] = [
  { to: "/todo", label: "TODO", icon: ListTodo, kind: "todo" },
  { to: "/calendar", label: "カレンダー", icon: CalendarDays, kind: "calendar" },
  { to: "/memo", label: "メモ", icon: NotebookPen, kind: "memo" }
]

function preloadTab(to: string) {
  if (to === "/calendar") {
    void import("@/pages/calendar-page").catch(() => undefined)
  }
}

const TodoEditorSheet = lazy(async () => ({ default: (await loadTodoEditor()).TodoEditorSheet }))
const CalendarEditorSheet = lazy(async () => ({ default: (await loadCalendarEditor()).CalendarEditorSheet }))

function EditorLoadingState() {
  return (
    <div role="status" className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/20">
      <span className="sr-only">入力画面を読み込み中</span>
      <span aria-hidden="true" className="size-7 animate-spin rounded-full border-2 border-primary/20 border-t-primary motion-reduce:animate-none" />
    </div>
  )
}

function EditorLoadError() {
  return (
    <div role="alert" className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/95 px-5 text-center">
      <p className="text-sm text-muted-foreground">入力画面を表示できませんでした。</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>再読み込み</Button>
    </div>
  )
}

export function AppShell() {
  const location = useLocation()
  const active = tabs.find((tab) => location.pathname.startsWith(tab.to))
  const isSettings = location.pathname === "/settings"
  const requestedSettingsReturn = (location.state as { from?: unknown } | null)?.from
  const settingsReturnTo = tabs.find(tab => tab.to === requestedSettingsReturn)?.to ?? "/todo"
  const reduceMotion = useReducedMotion()
  const [today, setToday] = useState(() => new Date())
  const { editor, deleted, storageError, openCreate, closeEditor, undoDelete, dismissDeleted } = useTodos()
  const calendar = useCalendar()
  const { members } = useWorkspaceMembership()
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof localStorage !== "undefined" && localStorage.getItem("noca.theme") === "dark" ? "dark" : "light"
  )

  useEffect(() => {
    let rolloverTimer: number
    const refreshDate = () => {
      const now = new Date()
      setToday(now)
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      rolloverTimer = window.setTimeout(refreshDate, nextMidnight.getTime() - now.getTime() + 50)
    }
    const onResume = () => {
      if (document.visibilityState === "visible") {
        window.clearTimeout(rolloverTimer)
        refreshDate()
      }
    }
    refreshDate()
    window.addEventListener("focus", onResume)
    document.addEventListener("visibilitychange", onResume)
    return () => {
      window.clearTimeout(rolloverTimer)
      window.removeEventListener("focus", onResume)
      document.removeEventListener("visibilitychange", onResume)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("noca.theme", theme)
    const background = getComputedStyle(document.documentElement).getPropertyValue("--background").trim()
    if (background) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", background)
  }, [theme])

  useEffect(() => { closeEditor(); calendar.closeEditor() }, [location.pathname, closeEditor, calendar.closeEditor])
  const page = useOutlet({ theme, onThemeChange: setTheme })

  return (
    <div className="app-shell relative">
      <header data-testid="app-header" className="app-header sticky top-0 z-40 border-b border-border/65 bg-background/95 px-5 pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <span className="shrink-0 text-[23px] font-extrabold tracking-[-0.08em] text-primary">noca<span className="text-success">.</span></span>
            <time data-testid="header-date" dateTime={format(today, "yyyy-MM-dd")}
              className="shrink-0 whitespace-nowrap rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold tracking-[0.025em] text-secondary-foreground">
              {format(today, "M月d日（E）", { locale: ja })}
            </time>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className={cn("mr-1 flex items-center", members.length > 1 ? "-space-x-2" : "")} role="group"
              aria-label={`利用中のメンバー: ${members.map(member => member.displayName).join("、")}`}>
              {members.map(member => (
                <OwnerAvatar key={member.id} owner={member.id} label={member.displayName}
                  size="lg" decorative className="border-[3px] border-background" />
              ))}
            </div>
            <Link to={isSettings ? settingsReturnTo : "/settings"} state={isSettings ? undefined : { from: active?.to ?? "/todo" }}
              onPointerEnter={isSettings ? undefined : preloadTodoCategorySettings}
              onPointerDown={isSettings ? undefined : preloadTodoCategorySettings}
              onFocus={isSettings ? undefined : preloadTodoCategorySettings}
              aria-label={isSettings ? "設定を閉じる" : "設定を開く"} aria-current={isSettings ? "page" : undefined}
              className={cn("tap-target flex items-center justify-center rounded-full transition-colors", isSettings ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-secondary")}>
              {isSettings ? <X className="size-5" /> : <Settings className="size-5" />}
            </Link>
          </div>
        </div>
      </header>

      <main id="main-content" aria-label={isSettings ? "設定" : active?.label ?? "TODO"}
        className={cn("app-content px-5 pt-5", isSettings && "app-content-settings")}>
        {isSettings ? page : (
          <AnimatePresence initial={false} mode="wait">
            <m.div key={location.pathname} data-page-transition={location.pathname}
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }} exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.07, ease: "easeOut" }}>
              {page}
            </m.div>
          </AnimatePresence>
        )}
      </main>

      {!isSettings && <div data-testid="bottom-dock"
        className={cn("bottom-dock pointer-events-none fixed left-1/2 z-30 flex w-[calc(100%-32px)] max-w-[508px] -translate-x-1/2 items-center gap-4", active?.kind === "memo" && "max-w-[360px]")}>
        <nav className={cn("bottom-nav pointer-events-auto flex min-w-0 flex-1 items-center rounded-[25px] border border-border/80 bg-card/95 p-[7px] backdrop-blur-2xl", active?.kind === "memo" && "w-full")}
          aria-label="メインメニュー">
          <div className="flex min-w-0 flex-1 items-center">
            <LayoutGroup id="global-bottom-tabs">
              {tabs.map(({ to, label, icon: Icon }) => (
                <NavLink key={to} to={to}
                  onPointerEnter={() => preloadTab(to)}
                  onPointerDown={() => preloadTab(to)}
                  onFocus={() => preloadTab(to)}
                  className={({ isActive }) => cn(
                    "relative flex min-h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[16px] text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive && "text-primary"
                  )} aria-label={label}>
                  {({ isActive }) => (
                    <>
                      {isActive && <m.span layoutId="nav-indicator" aria-hidden="true" className="absolute inset-0 rounded-[16px] bg-secondary"
                        transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 470, damping: 38 }} />}
                      <span className="relative z-10 flex h-[27px] w-full max-w-[54px] items-center justify-center rounded-full">
                        <Icon className="size-[21px]" strokeWidth={2} />
                      </span>
                      <span className={cn("relative z-10 text-[10px] leading-tight", isActive ? "font-bold" : "font-medium")}>{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </LayoutGroup>
          </div>
        </nav>
        {active && active.kind !== "memo" && (
          <m.div className="pointer-events-auto shrink-0"
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 510, damping: 29 }}>
            <Button type="button" size="fab" aria-label={active.label + "を追加"}
              data-testid="dock-add-button"
              onPointerEnter={active.kind === "todo" ? preloadTodoEditor : preloadCalendarEditor}
              onPointerDown={active.kind === "todo" ? preloadTodoEditor : preloadCalendarEditor}
              onFocus={active.kind === "todo" ? preloadTodoEditor : preloadCalendarEditor}
              onClick={() => { if (active.kind === "todo") openCreate(); else calendar.openCreate() }}
              className="dock-create bg-dock-create-bg text-dock-create-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
              <Plus className="size-[27px] stroke-[2.5px]" />
            </Button>
          </m.div>
        )}
      </div>}
      <div className="pointer-events-none fixed bottom-[calc(105px+env(safe-area-inset-bottom))] left-1/2 z-40 flex w-full max-w-[540px] -translate-x-1/2 flex-col gap-2 px-5">
        <AnimatePresence initial={false}>
          {deleted && <UndoToast key={"todo-" + deleted.task.id} message="タスクを削除しました" onUndo={undoDelete} onDismiss={dismissDeleted} />}
          {calendar.deleted && <UndoToast key={"event-" + calendar.deleted.event.id} message="予定を削除しました" onUndo={calendar.undoDelete} onDismiss={calendar.dismissDeleted} />}
        </AnimatePresence>
      </div>
      {(storageError || calendar.storageError) && (
        <div role="alert" className="fixed left-1/2 top-[calc(60px+env(safe-area-inset-top))] z-40 w-[calc(100%-40px)] max-w-[480px] -translate-x-1/2 rounded-xl bg-destructive px-4 py-3 text-sm font-medium text-destructive-foreground shadow-lg">
          この端末に保存できません。ブラウザの設定を確認してください。
        </div>
      )}
      <ChunkLoadBoundary fallback={<EditorLoadError />}>
        <Suspense fallback={<EditorLoadingState />}>
          {editor && <TodoEditorSheet key={editor.mode === "edit" ? editor.id : "create"} />}
          {calendar.editor && <CalendarEditorSheet key={calendar.editor.mode === "edit" ? calendar.editor.id : "create-" + calendar.editor.date} />}
        </Suspense>
      </ChunkLoadBoundary>
    </div>
  )
}
