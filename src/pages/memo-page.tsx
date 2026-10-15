import { useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { ArrowUpRight, NotebookPen, Pin, Search, X } from "lucide-react"
import { mockNotes, type SharedNote } from "@/app/mock-data"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

export function MemoPage() {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<SharedNote | null>(null)
  const reduceMotion = useReducedMotion()
  const visible = useMemo(() => mockNotes.filter((note) =>
    (note.title + " " + note.body).toLocaleLowerCase("ja").includes(search.trim().toLocaleLowerCase("ja"))
  ), [search])

  return (
    <div className="space-y-6" data-testid="memo-page">

      <div role="search" aria-label="メモを検索" className="flex h-[52px] items-center gap-3 rounded-xl border border-border bg-card px-4 text-muted-foreground transition-[border-color,box-shadow] focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/20">
        <Search className="size-[19px] shrink-0" aria-hidden="true" />
        <Label htmlFor="memo-search" className="sr-only">メモを検索</Label>
        <Input id="memo-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="メモを検索"
          className="h-11 min-w-0 flex-1 rounded-none border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0" />
        {search && <Button type="button" variant="ghost" size="icon" aria-label="検索をクリア" onClick={() => setSearch("")} className="shrink-0 rounded-full"><X className="size-4" /></Button>}
      </div>

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
              <Button type="button" variant="ghost" onClick={() => setSelected(note)}
                className="noca-card h-auto w-full flex-col items-stretch justify-start whitespace-normal rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:bg-accent/45 active:bg-secondary" aria-label={note.title + "を開く"}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="min-w-0 text-[15px] font-bold">{note.title}</h3>
                  {note.pinned && <Pin className="size-4 shrink-0 text-pin" aria-label="ピン留め" />}
                </div>
                <p className="line-clamp-2 whitespace-pre-wrap break-words text-[13px] leading-[1.7] text-muted-foreground">{note.body}</p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">{note.updated}</span>
                  <ArrowUpRight className="size-[17px] text-muted-foreground/60" />
                </div>
              </Button>
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
