import type { ReactNode } from "react"
import { lazy, Suspense, useRef, useState, type ChangeEvent } from "react"
import { useLocation, useNavigate, useOutletContext } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { ChunkLoadBoundary } from "@/components/chunk-load-boundary"
import { loadConfirmDialog, loadTodoCategorySettings, preloadConfirmDialog } from "@/components/settings-loaders"
import {
  ArrowLeft, Bell, CalendarClock, Check, Cloud, Copy, Database, Download, Info, LoaderCircle, LogIn, LogOut, Upload,
  ListTodo, LockKeyhole, Moon, Palette, ShieldCheck, Sun, UserRoundPlus,
  UsersRound
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTodos } from "@/features/todos/todo-store"
import { CALENDAR_SAMPLE_MIGRATION_KEYS, useCalendar } from "@/features/calendar/calendar-store"
import { useWorkspaceMembership } from "@/features/workspace/workspace-membership"
import { useWorkspaceDataSync } from "@/features/workspace/workspace-data-sync-context"
import { isFirebaseConfigured } from "@/features/workspace/firebase-env"
import { workspaceErrorMessage } from "@/features/workspace/workspace-errors"
import type { WorkspaceSyncConflict } from "@/features/workspace/firebase-workspace-data"
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

function conflictSummary(conflict: WorkspaceSyncConflict, side: "local" | "remote") {
  if (side === "local" && conflict.localAction === "delete") return "削除"
  const record = side === "local" ? conflict.localRecord : conflict.remoteRecord
  if (!record) return "削除"
  if ("date" in record) {
    const time = record.time ? `${record.time}${record.endTime ? `–${record.endTime}` : ""}` : "終日"
    return `${record.title} · ${record.date} ${time} · ${record.category}`
  }
  if ("title" in record) {
    const details = [record.category, record.done ? "完了" : "未完了", record.dueDate ? `期限 ${record.dueDate}` : null]
      .filter((item): item is string => item !== null)
    return `${record.title} · ${details.join(" · ")}`
  }
  const order = side === "local" ? conflict.localSortOrder : conflict.remoteSortOrder
  return `${record.name}${typeof order === "number" ? ` · ${order + 1}番目` : ""}`
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
  const { todos, categories, deviceTodos, deviceCategories, restoreLocalData: restoreTodos } = useTodos()
  const { events, deviceEvents, restoreLocalData: restoreEvents } = useCalendar()
  const syncData = useWorkspaceDataSync()
  const {
    members, authStatus, workspaceStatus, authUser, workspace, authError,
    signInWithGoogle, signOut, createWorkspace, createInvite
  } = useWorkspaceMembership()
  const [backupState, setBackupState] = useState<"idle" | "saving" | "saved" | "shared" | "error">("idle")
  const [memberBusy, setMemberBusy] = useState(false)
  const [memberMessage, setMemberMessage] = useState("")
  const [inviteLink, setInviteLink] = useState("")
  const [inviteCopied, setInviteCopied] = useState(false)
  const [isReadingBackup, setIsReadingBackup] = useState(false)
  const [pendingBackup, setPendingBackup] = useState<LocalBackup | null>(null)
  const [restoreMessage, setRestoreMessage] = useState("")
  const [restoreMessageIsError, setRestoreMessageIsError] = useState(false)
  const backupFileInput = useRef<HTMLInputElement>(null)
  const requestedFrom = (location.state as { from?: unknown } | null)?.from
  const returnTo = requestedFrom === "/calendar" || requestedFrom === "/memo" || requestedFrom === "/todo"
    ? requestedFrom : "/todo"

  const handleMemberAction = async (action: "sign-in" | "sign-out" | "create-workspace" | "create-invite") => {
    if (memberBusy) return
    setMemberBusy(true)
    setMemberMessage("")
    try {
      if (action === "sign-in") await signInWithGoogle()
      if (action === "sign-out") {
        await signOut()
        setInviteLink("")
        setMemberMessage("ログアウトしました。端末内のTODO・予定はそのまま残っています。")
      }
      if (action === "create-workspace") {
        await createWorkspace()
        setMemberMessage("共有スペースを作成しました。データの同期方法は「データ」から選べます。")
      }
      if (action === "create-invite") {
        const invite = await createInvite()
        setInviteLink(invite.url)
        setInviteCopied(false)
        setMemberMessage("招待リンクを作成しました。有効期限は24時間です。")
      }
    } catch (error) {
      setMemberMessage(workspaceErrorMessage(error))
    } finally {
      setMemberBusy(false)
    }
  }

  const beginDataSync = async (includeThisDevice: boolean) => {
    if (memberBusy) return
    setMemberBusy(true)
    setMemberMessage("")
    try {
      await syncData.startSync(includeThisDevice, {
        todos: deviceTodos,
        categories: deviceCategories,
        events: deviceEvents
      })
      setMemberMessage(includeThisDevice
        ? "この端末のTODO・カテゴリ・予定を共有データへ追加しました。"
        : "共有データで開始しました。この端末のデータは端末内に残っています。")
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "共有同期を開始できませんでした。")
    } finally {
      setMemberBusy(false)
    }
  }

  const importThisDeviceData = async () => {
    if (memberBusy) return
    setMemberBusy(true)
    setMemberMessage("")
    try {
      await syncData.importLocalData({
        todos: deviceTodos,
        categories: deviceCategories,
        events: deviceEvents
      })
      setMemberMessage("この端末のデータを共有へ追加しました。")
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "この端末のデータを追加できませんでした。")
    } finally {
      setMemberBusy(false)
    }
  }

  const resolveSyncConflict = async (id: string, choice: "local" | "remote") => {
    if (memberBusy) return
    setMemberBusy(true)
    setMemberMessage("")
    try {
      await syncData.resolveConflict(id, choice)
    } catch (error) {
      setMemberMessage(error instanceof Error ? error.message : "競合を解決できませんでした。")
    } finally {
      setMemberBusy(false)
    }
  }

  const copyInviteLink = async () => {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      setInviteCopied(true)
      setMemberMessage("招待リンクをコピーしました。")
    } catch {
      setMemberMessage("リンクを選択してコピーしてください。")
    }
  }

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
      if (!syncData.isActive) restoreLocalBackup(pendingBackup)
      restoreTodos(pendingBackup.data.todos, pendingBackup.data.todoCategories)
      restoreEvents(pendingBackup.data.calendarEvents)
      setRestoreMessage(syncData.isActive ? "バックアップの内容を共有データへ反映しました。" : "バックアップを復元しました。")
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

      <SettingsGroup title="メンバー">
        <div data-testid="workspace-members" className="flex min-h-[76px] items-center gap-3 border-b border-border/70 px-4 py-3">
          <IconBox tone="blue"><UsersRound className="size-[19px]" /></IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">{workspace ? "共有スペースのメンバー" : "現在のメンバー"}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{members.map(member => member.displayName).join("・")}（{members.length}人）</p>
          </div>
        </div>

        {!isFirebaseConfigured ? (
          <>
            <ComingSoonRow icon={UserRoundPlus} title="相手を招待" description="Firebase接続設定が必要です" />
            <ComingSoonRow icon={LockKeyhole} title="Googleログイン" description="認証プロジェクト未設定" />
          </>
        ) : authStatus === "loading" ? (
          <div role="status" className="flex min-h-[64px] items-center gap-3 px-4 py-3 text-[13px] text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> アカウントを確認しています
          </div>
        ) : authStatus === "signed-out" ? (
          <div className="space-y-3 px-4 py-4">
            <p className="text-[12px] leading-relaxed text-muted-foreground">Googleでログインすると、共有スペースを作成したり招待から参加できます。</p>
            <Button type="button" className="min-h-11 w-full rounded-xl text-[13px]" disabled={memberBusy}
              onClick={() => void handleMemberAction("sign-in")}>
              {memberBusy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <LogIn className="size-4" />}
              Googleでログイン
            </Button>
          </div>
        ) : authUser ? (
          <div className="space-y-4 px-4 py-4">
            <div className="flex items-center gap-3">
              {authUser.photoURL ? <img src={authUser.photoURL} alt="" className="size-10 rounded-full bg-secondary object-cover" /> : <IconBox><LockKeyhole className="size-[19px]" /></IconBox>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{authUser.displayName}</p>
                <p className="truncate text-[12px] text-muted-foreground">{authUser.email || "Googleアカウント"}</p>
              </div>
            </div>

            {workspaceStatus === "loading" ? (
              <div role="status" className="flex items-center gap-2 text-[12px] text-muted-foreground">
                <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> メンバー情報を読み込んでいます
              </div>
            ) : workspaceStatus === "none" ? (
              <>
                <p className="text-[12px] leading-relaxed text-muted-foreground">招待リンクから参加するか、新しい共有スペースを作成してください。</p>
                <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl text-[13px]" disabled={memberBusy}
                  onClick={() => void handleMemberAction("create-workspace")}>
                  {memberBusy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <UsersRound className="size-4" />}
                  共有スペースを作成
                </Button>
              </>
            ) : workspace ? (
              <>
                {workspace.members.length === 1 && workspace.ownerUid === authUser.uid ? (
                  <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl text-[13px]" disabled={memberBusy}
                    onClick={() => void handleMemberAction("create-invite")}>
                    {memberBusy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <UserRoundPlus className="size-4" />}
                    招待リンクを作成・再発行
                  </Button>
                ) : (
                  <p className="rounded-xl bg-secondary/70 px-3 py-2.5 text-[12px] leading-relaxed text-muted-foreground">
                    共有スペースに参加しています。TODO・カテゴリ・予定は「データ」から同期を開始できます。
                  </p>
                )}
                {inviteLink && <div className="flex gap-2">
                  <input aria-label="招待リンク" readOnly value={inviteLink}
                    className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 text-[12px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
                  <Button type="button" variant="secondary" size="icon" className="tap-target shrink-0 rounded-xl" onClick={() => void copyInviteLink()} aria-label="招待リンクをコピー">
                    {inviteCopied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
                  </Button>
                </div>}
              </>
            ) : (
              <p className="text-[12px] text-muted-foreground">共有スペース情報を読み込めませんでした。</p>
            )}

            <Button type="button" variant="ghost" className="min-h-10 w-full rounded-xl text-[12px] text-muted-foreground" disabled={memberBusy}
              onClick={() => void handleMemberAction("sign-out")}>
              <LogOut className="size-4" /> ログアウト
            </Button>
          </div>
        ) : (
          <div role="alert" className="px-4 py-3 text-[12px] text-destructive">{authError || "アカウント情報を読み込めませんでした。"}</div>
        )}

        {(memberMessage || authError) && <p role="status" aria-live="polite" className="px-4 pb-3 text-[12px] leading-relaxed text-muted-foreground">{memberMessage || authError}</p>}
      </SettingsGroup>

      <SettingsGroup title="通知">
        <ComingSoonRow icon={CalendarClock} title="予定のリマインダー" />
        <ComingSoonRow icon={ListTodo} title="TODOの期限通知" />
        <ComingSoonRow icon={Bell} title="共有内容の更新通知" />
      </SettingsGroup>

      <SettingsGroup title="データ">
        <div className="flex min-h-[76px] items-center gap-3 border-b border-border/70 px-4 py-3">
          <IconBox tone={syncData.isActive ? "green" : "blue"}>{syncData.isActive ? <Cloud className="size-[19px]" /> : <Database className="size-[19px]" />}</IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">データの保存先</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {syncData.isActive
                ? syncData.status === "syncing" ? "共有スペースへ同期中"
                  : syncData.status === "offline" ? "オフライン・変更は端末に保留中"
                    : syncData.status === "error" ? "共有データを同期できませんでした"
                      : syncData.status === "loading" ? "共有データを読み込み中"
                        : "共有スペースと同期済み"
                : "この端末内に保存"}
            </p>
          </div>
          {syncData.isActive
            ? syncData.status === "syncing" || syncData.status === "loading"
              ? <LoaderCircle className="size-[19px] animate-spin text-primary motion-reduce:animate-none" aria-label="同期中" />
              : <Cloud className="size-[19px] text-success" aria-label="共有保存" />
            : <ShieldCheck className="size-[19px] text-success" aria-label="端末内保存" />}
        </div>
        {syncData.status === "setup-required" && workspace ? (
          <div className="space-y-3 border-b border-border/70 px-4 py-4">
            <div>
              <p className="text-[13px] font-semibold">共有データの利用を開始</p>
              <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                この端末にはTODO {deviceTodos.length}件・カテゴリ {deviceCategories.length}件・予定 {deviceEvents.length}件があります。追加して開始すると共有スペースへ取り込みます。端末内の元データもそのまま残ります。
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                別端末で別々に作った同じ内容の項目は、別の項目として追加されることがあります。
              </p>
            </div>
            <Button type="button" className="min-h-11 w-full rounded-xl text-[13px]" disabled={memberBusy}
              onClick={() => void beginDataSync(true)}>
              {memberBusy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Cloud className="size-4" />}
              この端末のデータを追加して開始
            </Button>
            <Button type="button" variant="outline" className="min-h-11 w-full rounded-xl text-[13px]" disabled={memberBusy}
              onClick={() => void beginDataSync(false)}>
              共有データだけで開始
            </Button>
          </div>
        ) : syncData.isActive ? (
          <div className="space-y-3 border-b border-border/70 px-4 py-4">
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              {syncData.pendingCount > 0 ? `${syncData.pendingCount}件の変更を同期待ちです。` : "TODO・カテゴリ・予定を共有スペースへ保存します。"}
              {syncData.conflicts.length > 0 ? ` ${syncData.conflicts.length}件の変更で、どちらを残すか選択が必要です。` : ""}
            </p>
            {syncData.errorMessage && <p role="alert" className="text-[12px] leading-relaxed text-destructive">{syncData.errorMessage}</p>}
            {(syncData.status === "offline" || syncData.status === "error") && (
              <Button type="button" variant="outline" className="min-h-10 w-full rounded-xl text-[12px]" disabled={memberBusy}
                onClick={() => void syncData.retrySync()}>
                <Cloud className="size-4" /> 再同期
              </Button>
            )}
            <div className="space-y-2 rounded-xl bg-secondary/70 p-3">
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                この端末に残るTODO・カテゴリ・予定をあとから追加できます。同じ元データは重複せず、共有側と内容が異なる項目は競合として確認できます。端末内の元データも保持されます。
              </p>
              <Button type="button" variant="outline" className="min-h-10 w-full rounded-xl text-[12px]" disabled={memberBusy}
                onClick={() => void importThisDeviceData()}>
                {memberBusy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <Upload className="size-4" />}
                この端末のデータを共有へ追加
              </Button>
            </div>
            {syncData.conflicts.map(conflict => (
              <div key={conflict.id} className="space-y-2 rounded-xl border border-border bg-background/70 p-3">
                <div>
                  <p className="truncate text-[13px] font-semibold">{conflict.entityName}</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    別端末でも変更されています。残す内容を選んでください。
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-background/70 p-2 text-[11px] leading-relaxed">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">この端末</p>
                    <p className="break-words text-muted-foreground">{conflictSummary(conflict, "local")}</p>
                  </div>
                  <div className="min-w-0 border-l border-border/70 pl-2">
                    <p className="font-semibold text-foreground">共有側</p>
                    <p className="break-words text-muted-foreground">{conflictSummary(conflict, "remote")}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" className="min-h-10 rounded-xl px-2 text-[11px]" disabled={memberBusy}
                    onClick={() => void resolveSyncConflict(conflict.id, "local")}>
                    この端末の変更
                  </Button>
                  <Button type="button" variant="outline" className="min-h-10 rounded-xl px-2 text-[11px]" disabled={memberBusy}
                    onClick={() => void resolveSyncConflict(conflict.id, "remote")}>
                    共有側の内容
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
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
