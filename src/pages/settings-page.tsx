import type { ReactNode } from "react"
import { lazy, Suspense, useRef, useState, type ChangeEvent } from "react"
import { useLocation, useNavigate, useOutletContext } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ChunkLoadBoundary } from "@/components/chunk-load-boundary"
import { loadConfirmDialog, loadTodoCategorySettings, preloadConfirmDialog } from "@/components/settings-loaders"
import {
  ArrowLeft, Bell, CalendarClock, Check, Cloud, Database, Download, Info, Upload,
  ListTodo, LockKeyhole, Moon, Palette, ShieldCheck, Sun, UserRoundPlus,
  UsersRound
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTodos } from "@/features/todos/todo-store"
import { CALENDAR_SAMPLE_MIGRATION_KEYS, useCalendar } from "@/features/calendar/calendar-store"
import { createLocalBackup, localBackupFilename, MAX_LOCAL_BACKUP_SIZE_BYTES, parseLocalBackup, restoreLocalBackup, type LocalBackup } from "@/features/data/local-backup"

type Theme = "light" | "dark"
type ThemeOutlet = { theme: Theme; onThemeChange: (theme: Theme) => void }
type ComingSoonItem = { icon: typeof Bell; title: string; description?: string }

const TodoCategorySettings = lazy(async () => ({ default: (await loadTodoCategorySettings()).TodoCategorySettings }))
const ConfirmDialog = lazy(async () => ({ default: (await loadConfirmDialog()).ConfirmDialog }))

function CategorySettingsLoading({ count }: { count: number }) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">カテゴリ設定を読み込み中</span>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex h-[60px] items-center gap-3 border-b border-border/70 px-4">
          <div className="size-6 shrink-0 rounded-full bg-secondary" />
          <div className="h-9 flex-1 rounded-md bg-secondary/70" />
          <div className="size-9 shrink-0 rounded-full bg-secondary/70" />
        </div>
      ))}
      <div className="h-[108px] bg-background/55" />
    </div>
  )
}

function SettingsLoadError({ label, overlay = false }: { label: string; overlay?: boolean }) {
  return (
    <div role="alert" className={cn("flex min-h-32 flex-col items-center justify-center gap-3 px-4 text-center",
      overlay && "fixed inset-0 z-[61] bg-background/95")}>
      <p className="text-sm text-muted-foreground">{label}を表示できませんでした。</p>
      <Button type="button" variant="outline" onClick={() => window.location.reload()}>再読み込み</Button>
    </div>
  )
}

function RestorePreviewLoading() {
  return (
    <div role="status" className="fixed inset-0 z-[60] flex items-center justify-center bg-overlay/45 px-5">
      <span className="rounded-xl bg-card px-4 py-3 text-sm font-medium text-foreground shadow-lg">復元内容を表示中…</span>
    </div>
  )
}

function SoonBadge() {
  return <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">準備中</span>
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="space-y-3">
      <h2 className="px-1 text-[13px] font-bold tracking-wide text-muted-foreground">{title}</h2>
      <div className="noca-card overflow-hidden rounded-2xl border border-border bg-card">{children}</div>
    </section>
  )
}

function IconBox({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "peach" }) {
  return (
    <span className={cn(
      "flex size-10 shrink-0 items-center justify-center rounded-md",
      tone === "blue" && "bg-secondary text-primary",
      tone === "green" && "bg-success/15 text-success",
      tone === "peach" && "bg-owner-b-surface text-owner-b-strong"
    )}>{children}</span>
  )
}

function ComingSoonRow({ icon: Icon, title, description }: ComingSoonItem) {
  return (
    <div className="flex min-h-[76px] items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0">
      <IconBox><Icon className="size-[19px]" strokeWidth={1.9} /></IconBox>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        {description && <p className="mt-1 text-[12px] text-muted-foreground">{description}</p>}
      </div>
      <SoonBadge />
    </div>
  )
}

export function SettingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, onThemeChange } = useOutletContext<ThemeOutlet>()
  const { todos, categories, restoreLocalData: restoreTodos } = useTodos()
  const { events, restoreLocalData: restoreEvents } = useCalendar()
  const [backupState, setBackupState] = useState<"idle" | "saving" | "saved" | "shared" | "error">("idle")
  const [isReadingBackup, setIsReadingBackup] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<LocalBackup | null>(null)
  const [restoreMessage, setRestoreMessage] = useState("")
  const [restoreMessageIsError, setRestoreMessageIsError] = useState(false)
  const backupFileInput = useRef<HTMLInputElement>(null)
  const requestedFrom = (location.state as { from?: unknown } | null)?.from
  const returnTo = requestedFrom === "/calendar" || requestedFrom === "/memo" || requestedFrom === "/todo"
    ? requestedFrom : "/todo"

  const exportBackup = async () => {
    if (backupState === "saving") return
    setBackupState("saving")

    try {
      const filename = localBackupFilename()
      const backup = createLocalBackup(
        { todos, todoCategories: categories, calendarEvents: events },
        {
          calendarSampleMigrations: {
            v2: localStorage.getItem(CALENDAR_SAMPLE_MIGRATION_KEYS.v2) === "done",
            v3: localStorage.getItem(CALENDAR_SAMPLE_MIGRATION_KEYS.v3) === "done"
          }
        }
      )
      const file = new File([JSON.stringify(backup, null, 2)], filename, { type: "application/json" })

      let canShareFile = false
      try {
        canShareFile = typeof navigator.share === "function" && navigator.canShare?.({ files: [file] }) === true
      } catch {
        // Continue to the browser download fallback if file sharing is unavailable.
      }
      if (canShareFile) {
        try {
          await navigator.share({ files: [file], title: "nocaのバックアップ" })
          setBackupState("shared")
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            setBackupState("idle")
            return
          }
          // A failed native share should still allow the user to download the file.
        }
      }

      const url = URL.createObjectURL(file)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      link.style.display = "none"
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setBackupState("saved")
    } catch {
      setBackupState("error")
    }
  }

  const readBackupFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ""
    if (!file) return
    setRestoreMessage("")

    if (file.size > MAX_LOCAL_BACKUP_SIZE_BYTES) {
      setRestoreMessage("ファイルが大きすぎます。20MB以下のバックアップを選んでください。")
      setRestoreMessageIsError(true)
      return
    }

    setIsReadingBackup(true)
    try {
      setPendingBackup(parseLocalBackup(await file.text()))
      setRestoreMessageIsError(false)
    } catch (error) {
      setRestoreMessage(error instanceof Error ? error.message : "バックアップを読み取れませんでした。")
      setRestoreMessageIsError(true)
    } finally {
      setIsReadingBackup(false)
    }
  }

  const applyBackup = () => {
    if (!pendingBackup) return
    try {
      restoreLocalBackup(pendingBackup)
      restoreTodos(pendingBackup.data.todos, pendingBackup.data.todoCategories)
      restoreEvents(pendingBackup.data.calendarEvents)
      setRestoreMessage("バックアップを復元しました。")
      setRestoreMessageIsError(false)
      setPendingBackup(null)
    } catch (error) {
      setRestoreMessage(error instanceof Error ? error.message : "復元に失敗しました。")
      setRestoreMessageIsError(true)
    }
  }

  return (
    <div data-testid="settings-page" className="space-y-7 pb-4">
      <div className="flex min-h-11 items-center gap-3">
        <Button type="button" variant="ghost" size="icon" onClick={() => navigate(returnTo)} aria-label="前の画面に戻る"
          className="tap-target rounded-full text-muted-foreground">
          <ArrowLeft className="size-[22px]" />
        </Button>
        <h1 className="text-[23px] font-bold tracking-[-.035em]">設定</h1>
      </div>

      <SettingsGroup title="外観">
        <div className="space-y-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <IconBox><Palette className="size-[19px]" /></IconBox>
            <div>
              <p className="text-[14px] font-semibold">テーマ</p>
              <p className="mt-1 text-[12px] text-muted-foreground">この端末の表示設定</p>
            </div>
          </div>
          <div role="group" aria-label="テーマ" className="grid grid-cols-2 gap-2 rounded-[14px] bg-secondary/80 p-1.5">
            {([
              { value: "light" as const, label: "ライト", icon: Sun },
              { value: "dark" as const, label: "ダーク", icon: Moon }
            ]).map(option => {
              const Icon = option.icon
              const selected = theme === option.value
              return (
                <Button key={option.value} type="button" variant="ghost" aria-pressed={selected}
                  onClick={() => onThemeChange(option.value)}
                  className={cn("min-h-11 rounded-xl text-[13px]",
                    selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                  <Icon className="size-[17px]" aria-hidden="true" />
                  {option.label}
                  {selected && <Check className="size-[15px] text-primary" aria-hidden="true" />}
                </Button>
              )
            })}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="TODOカテゴリ">
        <ChunkLoadBoundary fallback={<SettingsLoadError label="カテゴリ設定" />}>
          <Suspense fallback={<CategorySettingsLoading count={categories.length} />}>
            <TodoCategorySettings />
          </Suspense>
        </ChunkLoadBoundary>
      </SettingsGroup>

      <SettingsGroup title="ふたりの共有">
        <ComingSoonRow icon={UsersRound} title="共有スペース" description="メンバー管理" />
        <ComingSoonRow icon={UserRoundPlus} title="相手を招待" description="招待リンク・コード" />
        <ComingSoonRow icon={LockKeyhole} title="アカウント" description="Googleログイン・プロフィール" />
      </SettingsGroup>

      <SettingsGroup title="通知">
        <ComingSoonRow icon={CalendarClock} title="予定のリマインダー" />
        <ComingSoonRow icon={ListTodo} title="TODOの期限通知" />
        <ComingSoonRow icon={Bell} title="共有内容の更新通知" />
      </SettingsGroup>

      <SettingsGroup title="データ">
        <div className="flex min-h-[76px] items-center gap-3 border-b border-border/70 px-4 py-3">
          <IconBox tone="green"><Database className="size-[19px]" /></IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">データの保存先</p>
            <p className="mt-1 text-[12px] text-muted-foreground">TODO・予定はこの端末内</p>
          </div>
          <ShieldCheck className="size-[19px] text-success" aria-label="端末内保存" />
        </div>
        <div className="space-y-3 border-b border-border/70 px-4 py-4">
          <div className="flex items-center gap-3">
            <IconBox tone="green"><Download className="size-[19px]" /></IconBox>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold">バックアップ</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                TODO・カテゴリ・予定をJSONで保存・復元できます。TODO・予定の詳細メモや住所も含み、復元時は内容を確認して置き換えます。
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={exportBackup} disabled={backupState === "saving"}
            className="min-h-11 w-full rounded-xl text-[13px]">
            <Download className="size-4" aria-hidden="true" />
            {backupState === "saving" ? "準備中…" : "バックアップを書き出す"}
          </Button>
          <p role="status" aria-live="polite" className={cn("min-h-4 text-[12px]", backupState === "error" ? "text-destructive" : "text-muted-foreground")}>
            {backupState === "shared" ? "バックアップファイルを共有しました。" : backupState === "saved" ? "バックアップファイルを保存しました。" : backupState === "error" ? "バックアップを保存できませんでした。もう一度お試しください。" : ""}
          </p>
          <input ref={backupFileInput} className="sr-only" type="file" accept=".json,application/json"
            aria-label="バックアップファイルを選択" onChange={readBackupFile} />
          <Button type="button" variant="outline" onClick={() => backupFileInput.current?.click()}
            onPointerEnter={preloadConfirmDialog} onPointerDown={preloadConfirmDialog} onFocus={preloadConfirmDialog}
            disabled={isReadingBackup} className="min-h-11 w-full rounded-xl text-[13px]">
            <Upload className="size-4" aria-hidden="true" />
            {isReadingBackup ? "読み込み中…" : "バックアップから復元"}
          </Button>
          <p role="status" aria-live="polite" className={cn("min-h-4 text-[12px]", restoreMessageIsError ? "text-destructive" : "text-muted-foreground")}>
            {restoreMessage}
          </p>
        </div>
        <ComingSoonRow icon={Cloud} title="クラウド同期" description="2人のデータをリアルタイムで同期" />
      </SettingsGroup>

      <SettingsGroup title="アプリについて">
        <div className="flex min-h-[72px] items-center gap-3 px-4 py-3">
          <IconBox tone="peach"><Info className="size-[19px]" /></IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">noca</p>
            <p className="mt-1 text-[12px] text-muted-foreground">バージョン 0.1.0 ・ プレビュー版</p>
          </div>
        </div>
      </SettingsGroup>
      {pendingBackup && <ChunkLoadBoundary fallback={<SettingsLoadError label="復元内容" overlay />}><Suspense fallback={<RestorePreviewLoading />}><ConfirmDialog
        open={pendingBackup !== null}
        onOpenChange={open => { if (!open) setPendingBackup(null) }}
        onConfirm={applyBackup}
        title="バックアップを復元しますか？"
        description="現在の端末内のTODO・カテゴリ・予定を、選んだバックアップの内容に置き換えます。取り消しはできません。必要なら先に現在のデータを書き出してください。"
        confirmLabel="置き換えて復元"
        cancelLabel="キャンセル"
      >
        {pendingBackup && <div className="mt-4 space-y-3 rounded-xl bg-secondary/70 p-4 text-[13px]">
          <p className="text-[12px] text-muted-foreground">バックアップ作成日時</p>
          <p className="-mt-2 font-medium">{new Date(pendingBackup.exportedAt).toLocaleString("ja-JP")}</p>
          <dl className="grid grid-cols-3 gap-2 border-t border-border/70 pt-3 text-center">
            <div><dt className="text-[11px] text-muted-foreground">TODO</dt><dd className="mt-1 font-semibold">{pendingBackup.data.todos.length}件</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">カテゴリ</dt><dd className="mt-1 font-semibold">{pendingBackup.data.todoCategories.length}件</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">予定</dt><dd className="mt-1 font-semibold">{pendingBackup.data.calendarEvents.length}件</dd></div>
          </dl>
        </div>}
      </ConfirmDialog></Suspense></ChunkLoadBoundary>}
    </div>
  )
}
