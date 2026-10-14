import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUpRight, NotebookPen, Pin, Search, X } from "lucide-react"
import { mockNotes, type SharedNote } from "@/app/mock-data"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export function MemoPage() {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<SharedNote | null>(null)
  const reduceMotion = useReducedMotion()
  const visible = useMemo(() => mockNotes.filter((note) =>
    (note.title + " " + note.body).toLocaleLowerCase("ja").includes(search.trim().toLocaleLowerCase("ja"))
  ), [search])

  return (
    <div className="space-y-6" data-testid="memo-page">

      <label className="flex h-[52px] items-center gap-3 rounded-[17px] border border-border bg-card px-4 text-muted-foreground">
        <Search className="size-[19px] shrink-0" />
        <span className="sr-only">メモを検索</span>
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="メモを検索"
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground" />
        {search && <button type="button" aria-label="検索をクリア" onClick={() => setSearch("")} className="tap-target flex items-center justify-center"><X className="size-4" /></button>}
      </label>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold tracking-tight">すべてのメモ</h2>
          <span className="text-xs font-medium text-muted-foreground">{visible.length} 件</span>
        </div>
        <AnimatePresence initial={false} mode="wait">
        {visible.length === 0 ? (
          <motion.div key="empty" initial={reduceMotion ? false : { opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="rounded-[20px] border border-dashed border-border bg-card/60 px-4 py-11 text-center">
            <NotebookPen className="mx-auto mb-3 size-7 text-muted-foreground/50" />
            <p className="text-sm font-semibold">該当するメモがありません</p>
          </motion.div>
        ) : (
          <motion.div key="results" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.16 }} className="space-y-3">
            <AnimatePresence initial={false} mode="popLayout">
            {visible.map((note) => (
              <motion.div key={note.id} layout className="relative overflow-hidden"
                initial={reduceMotion ? false : { opacity: 0, height: 0, y: 8 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -5 }}
                transition={{ duration: reduceMotion ? 0 : 0.19 }}>
              <button type="button" onClick={() => setSelected(note)}
                className="noca-card w-full rounded-[20px] border border-border bg-card p-4 text-left transition-colors hover:bg-accent/45 active:bg-secondary" aria-label={note.title + "を開く"}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="min-w-0 text-[15px] font-bold">{note.title}</h3>
                  {note.pinned && <Pin className="size-4 shrink-0 text-[#b89a75]" aria-label="ピン留め" />}
                </div>
                <p className="line-clamp-2 whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-muted-foreground">{note.body}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{note.updated}</span>
                  <ArrowUpRight className="size-[17px] text-muted-foreground/60" />
                </div>
              </button>
              </motion.div>
            ))}
            </AnimatePresence>
          </motion.div>
        )}
        </AnimatePresence>
      </section>


      <Sheet open={Boolean(selected)} onOpenChange={(next) => { if (!next) setSelected(null) }}>
        <SheetContent>
          <SheetHeader className="pr-14">
            <SheetTitle className="text-left text-[22px] font-bold">{selected?.title}</SheetTitle>
            <SheetDescription className="text-left text-xs">更新: {selected?.updated} ・ UIプレビュー（読み取り専用）</SheetDescription>
          </SheetHeader>
          <SheetBody>
            <p className="min-h-[150px] whitespace-pre-wrap break-words text-sm leading-[1.9]">{selected?.body}</p>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </div>
  )
}
