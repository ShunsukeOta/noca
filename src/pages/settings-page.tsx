import type { ReactNode } from "react"
import { motion, useReducedMotion } from "motion/react"
import { useLocation, useNavigate, useOutletContext } from "react-router-dom"
import {
  ArrowLeft, Bell, CalendarClock, Check, Cloud, Database, Info,
  ListTodo, LockKeyhole, Moon, Palette, ShieldCheck, Sun, UserRoundPlus,
  UsersRound
} from "lucide-react"
import { cn } from "@/lib/utils"

type Theme = "light" | "dark"
type ThemeOutlet = { theme: Theme; onThemeChange: (theme: Theme) => void }
type ComingSoonItem = { icon: typeof Bell; title: string; description?: string }

function SoonBadge() {
  return <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">準備中</span>
}

function SettingsGroup({ title, children, index }: { title: string; children: ReactNode; index: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.section aria-label={title} className="space-y-3"
      initial={reduceMotion ? false : { opacity: 0, y: 9 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, delay: reduceMotion ? 0 : index * 0.035, ease: "easeOut" }}>
      <h2 className="px-1 text-[13px] font-bold tracking-wide text-muted-foreground">{title}</h2>
      <div className="noca-card overflow-hidden rounded-[21px] border border-border bg-card">{children}</div>
    </motion.section>
  )
}

function IconBox({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "green" | "peach" }) {
  return (
    <span className={cn(
      "flex size-10 shrink-0 items-center justify-center rounded-[13px]",
      tone === "blue" && "bg-secondary text-primary",
      tone === "green" && "bg-[#e6eee8] text-[#648874] dark:bg-[#2c443a] dark:text-[#a4d1ae]",
      tone === "peach" && "bg-[#f6e9e1] text-[#956e5b] dark:bg-[#523e35] dark:text-[#f0c5ac]"
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
  const requestedFrom = (location.state as { from?: unknown } | null)?.from
  const returnTo = requestedFrom === "/calendar" || requestedFrom === "/memo" || requestedFrom === "/todo"
    ? requestedFrom : "/todo"

  return (
    <div data-testid="settings-page" className="space-y-7 pb-4">
      <div className="flex min-h-11 items-center gap-3">
        <button type="button" onClick={() => navigate(returnTo)} aria-label="前の画面に戻る"
          className="tap-target flex items-center justify-center rounded-full text-muted-foreground hover:bg-secondary">
          <ArrowLeft className="size-[22px]" />
        </button>
        <h1 className="text-[23px] font-bold tracking-[-.035em]">設定</h1>
      </div>

      <SettingsGroup title="外観" index={0}>
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
                <button key={option.value} type="button" aria-pressed={selected}
                  onClick={() => onThemeChange(option.value)}
                  className={cn("flex min-h-11 items-center justify-center gap-2 rounded-xl text-[13px] font-semibold transition-colors",
                    selected ? "bg-card text-foreground shadow-sm" : "text-muted-foreground")}>
                  <Icon className="size-[17px]" aria-hidden="true" />
                  {option.label}
                  {selected && <Check className="size-[15px] text-primary" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>
      </SettingsGroup>

      <SettingsGroup title="ふたりの共有" index={1}>
        <ComingSoonRow icon={UsersRound} title="共有スペース" description="メンバー管理" />
        <ComingSoonRow icon={UserRoundPlus} title="相手を招待" description="招待リンク・コード" />
        <ComingSoonRow icon={LockKeyhole} title="アカウント" description="Googleログイン・プロフィール" />
      </SettingsGroup>

      <SettingsGroup title="通知" index={2}>
        <ComingSoonRow icon={CalendarClock} title="予定のリマインダー" />
        <ComingSoonRow icon={ListTodo} title="TODOの期限通知" />
        <ComingSoonRow icon={Bell} title="共有内容の更新通知" />
      </SettingsGroup>

      <SettingsGroup title="データ" index={3}>
        <div className="flex min-h-[76px] items-center gap-3 border-b border-border/70 px-4 py-3">
          <IconBox tone="green"><Database className="size-[19px]" /></IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">TODOの保存先</p>
            <p className="mt-1 text-[12px] text-muted-foreground">この端末内（プレビュー）</p>
          </div>
          <ShieldCheck className="size-[19px] text-success" aria-label="端末内保存" />
        </div>
        <ComingSoonRow icon={Cloud} title="クラウド同期" description="2人のデータをリアルタイムで同期" />
      </SettingsGroup>

      <SettingsGroup title="アプリについて" index={4}>
        <div className="flex min-h-[72px] items-center gap-3 px-4 py-3">
          <IconBox tone="peach"><Info className="size-[19px]" /></IconBox>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold">noca</p>
            <p className="mt-1 text-[12px] text-muted-foreground">バージョン 0.1.0 ・ プレビュー版</p>
          </div>
        </div>
      </SettingsGroup>
    </div>
  )
}
