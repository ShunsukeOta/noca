import { useState } from "react"
import { format, isThisWeek, parseISO } from "date-fns"
import { ja } from "date-fns/locale"
import { Check, ChevronDown, ChevronRight, Clock3, ListChecks, Sparkles } from "lucide-react"
import { type Task, type TaskCategory } from "@/app/mock-data"
import { useTodos } from "@/features/todos/todo-store"
import { cn } from "@/lib/utils"

type Filter = "すべて" | "今日" | "今週"
const filters: Filter[] = ["すべて", "今日", "今週"]
const categoryColor: Record<TaskCategory, string> = {
  "暮らし": "bg-[#e7f2e9] text-[#52785d] dark:bg-[#294535] dark:text-[#add6b3]",
  "おでかけ": "bg-[#f6e9e1] text-[#956e5b] dark:bg-[#523e35] dark:text-[#f0c5ac]",
  "ふたり": "bg-[#ece9f7] text-[#756b9c] dark:bg-[#3b3655] dark:text-[#d6cafa]",
  "その他": "bg-secondary text-secondary-foreground"
}

export function TodoPage() {
  const [filter, setFilter] = useState<Filter>("すべて")
  const { todos: tasks, toggleTodo, openEdit, openCreate } = useTodos()
  const [showCompleted, setShowCompleted] = useState(false)
  const today = format(new Date(), "yyyy-MM-dd")
  const visible = tasks.filter((task) => filter === "すべて" ? true : filter === "今日" ? task.dueDate === today : Boolean(task.dueDate && isThisWeek(parseISO(task.dueDate), { weekStartsOn: 1 })))
  const active = visible.filter((task) => !task.done)
  const completed = visible.filter((task) => task.done)
  const toggle = (task: Task) => toggleTodo(task.id)

  return (
    <div className="space-y-6" data-testid="todo-page">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <span className="text-[11px] font-bold tracking-[.17em] text-muted-foreground">YOUR EVERYDAY</span>
          <span className="size-1 rounded-full bg-[#a4b7ce]" />
          <span className="text-[11px] text-muted-foreground">ふたりで、少しずつ</span>
        </div>
        <h1 className="text-[32px] font-bold leading-[1.3] tracking-[-.045em]">やること</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">今日も、ひとつずつ片付けよう。</p>
      </div>

      <section className="noca-shadow relative overflow-hidden rounded-[23px] bg-primary px-5 py-5 text-primary-foreground">
        <div className="pointer-events-none absolute -right-7 -top-12 size-40 rounded-full border-[27px] border-white/8" />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-[12px] font-semibold text-primary-foreground/70">残りのタスク</p>
            <div className="mt-1 flex items-baseline gap-2"><span className="text-[34px] font-bold leading-none">{tasks.filter((t) => !t.done).length}</span><span className="text-sm text-primary-foreground/70">件</span></div>
            <p className="mt-3 text-xs text-primary-foreground/75">今日も一緒に、無理せず。</p>
          </div>
          <div className="flex size-[62px] items-center justify-center rounded-[20px] bg-white/14"><ListChecks className="size-7" strokeWidth={1.75} /></div>
        </div>
      </section>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="TODOの絞り込み">
        {filters.map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item}
            className={cn("h-11 shrink-0 rounded-full px-5 text-[13px] font-semibold transition-colors", filter === item ? "bg-primary text-primary-foreground" : "border border-border bg-card text-muted-foreground")}>
            {item}
          </button>
        ))}
      </div>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">これからすること</h2>
          <span className="text-xs font-medium text-muted-foreground">{active.length} 件</span>
        </div>
        <div className="noca-card overflow-hidden rounded-[20px] border border-border bg-card">
          {active.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-11 text-center">
              <div className="mb-1 flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Sparkles className="size-5" /></div>
              <p className="text-sm font-semibold">{tasks.length === 0 ? "最初のタスクを追加しよう" : "すべて終わりました"}</p>
              <p className="text-xs text-muted-foreground">思いついたことを気軽に残せます。</p>
              <button type="button" onClick={openCreate} className="mt-3 min-h-11 rounded-xl bg-secondary px-4 text-[13px] font-bold text-primary">＋ タスクを追加</button>
            </div>
          ) : active.map((task, index) => (
            <div key={task.id} className={cn("flex min-h-[85px] items-center gap-2.5 px-3.5 py-3", index > 0 && "border-t border-border/70")}>
              <button type="button" aria-label={task.title + "を完了"} onClick={() => toggle(task)}
                className="tap-target flex shrink-0 items-center justify-center rounded-full text-muted-foreground">
                <span className="size-[23px] rounded-full border-[1.7px] border-[#b5c1d0]" />
              </button>
              <button type="button" onClick={() => openEdit(task.id)} aria-label={task.title + "を編集"} className="min-w-0 flex-1 text-left">
                <p className="break-words text-[14px] font-semibold leading-snug">{task.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-md px-2 py-1 text-[10px] font-semibold", categoryColor[task.category])}>{task.category}</span>
                  {task.dueDate && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{format(parseISO(task.dueDate), "M/d (E)", { locale: ja })}</span>}
                </div>
              </button>
              <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold", task.by === "A" ? "bg-[#d7e7ea] text-[#3e6470]" : "bg-[#f3dfda] text-[#90625a]")} aria-label={"作成者 " + task.by}>{task.by}</span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
            </div>
          ))}
        </div>
      </section>

      {completed.length > 0 && (
        <section className="pb-3">
          <button type="button" onClick={() => setShowCompleted(v => !v)} aria-expanded={showCompleted} aria-controls="completed-tasks"
            className="mb-2 flex min-h-11 w-full items-center justify-between text-left">
            <span className="text-sm font-semibold text-muted-foreground">完了したこと <span className="ml-1 text-xs">({completed.length})</span></span>
            <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", showCompleted && "rotate-180")} />
          </button>
          {showCompleted && <div id="completed-tasks" className="overflow-hidden rounded-[18px] border border-border/75 bg-card/60">
            {completed.map((task) => (
              <div key={task.id} className="flex items-center gap-2 px-3.5 py-2.5">
                <button type="button" aria-label={task.title + "の完了を解除"} onClick={() => toggle(task)}
                  className="tap-target flex shrink-0 items-center justify-center rounded-full text-success">
                  <span className="flex size-[23px] items-center justify-center rounded-full bg-success text-white"><Check className="size-3.5" /></span>
                </button>
                <button type="button" onClick={() => openEdit(task.id)} aria-label={task.title + "を編集"}
                  className="min-h-11 min-w-0 flex-1 break-words text-left text-[13px] text-muted-foreground line-through">{task.title}</button>
              </div>
            ))}
          </div>}
        </section>
      )}
      <p className="text-center text-[11px] text-muted-foreground/80">Phase 1B ・ この端末内に仮保存（共有前）</p>
    </div>
  )
}
