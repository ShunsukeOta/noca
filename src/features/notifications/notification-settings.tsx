import { useEffect, useState } from "react"
import { Bell, CalendarClock, ListTodo } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  DEFAULT_PUSH_PREFERENCES,
  loadPushPreferences,
  pushEnvironment,
  savePushPreferences,
  type PushPreferences
} from "@/features/notifications/push-notification-service"

type PreferenceKey = keyof PushPreferences
type NotificationItem = { key: PreferenceKey; icon: typeof Bell; title: string; detail: string }

const items: NotificationItem[] = [
  { key: "eventReminders", icon: CalendarClock, title: "予定のリマインダー", detail: "時刻付き予定の30分前" },
  { key: "todoDeadlines", icon: ListTodo, title: "TODOの期限通知", detail: "期限当日の9:00" },
  { key: "sharedUpdates", icon: Bell, title: "相手の追加通知", detail: "共有スペースにTODO・予定が追加されたとき" }
]

type Props = {
  workspaceId: string | null
  uid: string | null
  canUseWorkspace: boolean
}

export function NotificationSettings({ workspaceId, uid, canUseWorkspace }: Props) {
  const [preferences, setPreferences] = useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES)
  const [active, setActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busyKey, setBusyKey] = useState<PreferenceKey | null>(null)
  const [message, setMessage] = useState("")
  const environment = pushEnvironment()
  const ready = canUseWorkspace && !!workspaceId && !!uid

  useEffect(() => {
    if (!ready || !workspaceId || !uid || !environment.supported || !environment.firebaseConfigured) {
      setActive(false)
      setPreferences(DEFAULT_PUSH_PREFERENCES)
      setLoading(false)
      setMessage("")
      return
    }
    let cancelled = false
    setActive(false)
    setPreferences(DEFAULT_PUSH_PREFERENCES)
    setMessage("")
    setLoading(true)
    void loadPushPreferences(workspaceId, uid).then(result => {
      if (cancelled) return
      setActive(result.active)
      setPreferences(result.preferences)
    }).catch(() => {
      if (!cancelled) setMessage("通知設定を読み込めませんでした。通信状態を確認してください。")
    }).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => { cancelled = true }
  }, [ready, workspaceId, uid, environment.firebaseConfigured, environment.supported])

  async function changePreference(key: PreferenceKey, enabled: boolean) {
    if (!workspaceId || !uid) return
    const next = { ...preferences, [key]: enabled }
    setBusyKey(key)
    setMessage("")
    try {
      await savePushPreferences(workspaceId, uid, next)
      setPreferences(next)
      const hasEnabledPreference = Object.values(next).some(Boolean)
      setActive(hasEnabledPreference)
      setMessage(enabled ? "この端末の通知を有効にしました。" : hasEnabledPreference ? "通知設定を更新しました。" : "この端末の通知を停止しました。")
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "通知設定を更新できませんでした。")
    } finally {
      setBusyKey(null)
    }
  }

  const unavailable = !environment.supported || environment.requiresHomeScreen || !ready
  const availabilityMessage = !environment.supported
    ? "このブラウザーはプッシュ通知に対応していません。"
    : !environment.configured
      ? "通知サーバーの設定が必要です。"
      : environment.requiresHomeScreen
        ? "iPhoneではホーム画面に追加したnocaから設定できます。"
        : !ready
          ? "Googleログイン後、共有同期を開始すると通知を設定できます。"
          : environment.permission === "denied"
            ? "ブラウザーでnocaの通知がブロックされています。サイト設定から通知を許可してください。"
          : "通知はこの端末に届きます。相手の追加通知は、共有中に相手がTODOや予定を追加したときに届きます。"

  return (
    <div>
      {(!active || environment.permission === "denied") && <p className="px-4 pb-2 pt-4 text-[12px] leading-relaxed text-muted-foreground">{availabilityMessage}</p>}
      {items.map(({ key, icon: Icon, title, detail }, index) => (
        <div key={key} className={cn("flex min-h-[72px] items-center gap-3 px-4 py-3", index < items.length - 1 && "border-b border-border/70")}>
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><Icon className="size-[19px]" strokeWidth={1.9} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">{title}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">{detail}</p>
          </div>
          <Switch
            aria-label={title}
            checked={preferences[key]}
            disabled={unavailable || loading || busyKey !== null || (!environment.configured && !preferences[key])}
            onCheckedChange={enabled => void changePreference(key, enabled)}
            className="tap-target h-8 w-14"
          />
        </div>
      ))}
      <p role="status" aria-live="polite" className="min-h-0 px-4 pb-3 text-[12px] leading-relaxed text-muted-foreground">
        {loading ? "通知設定を読み込んでいます…" : busyKey ? "通知設定を更新しています…" : message || (active ? "この端末で通知を受け取ります。" : "")}
      </p>
    </div>
  )
}
