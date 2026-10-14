import { useMemo, useState } from "react"
import { ArrowUpRight, NotebookPen, Pin, Search, X } from "lucide-react"
import { mockNotes, type SharedNote } from "@/app/mock-data"
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"

export function MemoPage() {
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<SharedNote | null>(null)
  const visible = useMemo(() => mockNotes.filter((note) =>
    (note.title + " " + note.body).toLocaleLowerCase("ja").includes(search.trim().toLocaleLowerCase("ja"))
  ), [search])

  return (
    <div className="space-y-6" data-testid="memo-page">
      <div>
        <p className="mb-1 text-[11px] font-bold tracking-[.17em] text-muted-foreground">LITTLE NOTES</p>
        <h1 className="text-[32px] font-bold leading-[1.3] tracking-[-.045em]">メモ</h1>
        <p className="mt-2 text-sm text-muted-foreground">思いついたことも、大切なことも。</p>
      </div>

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
        {visible.length === 0 ? (
          <div className="rounded-[20px] border border-dashed border-border bg-card/60 px-4 py-11 text-center">
            <NotebookPen className="mx-auto mb-3 size-7 text-muted-foreground/50" />
            <p className="text-sm font-semibold">該当するメモがありません</p>
            <p className="mt-1 text-xs text-muted-foreground">検索キーワードを変えてみましょう。</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map((note) => (
              <button type="button" key={note.id} onClick={() => setSelected(note)}
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
            ))}
          </div>
        )}
      </section>

      <div className="rounded-[19px] bg-[#e9eef7] px-4 py-4 dark:bg-[#253248]">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-card text-primary"><NotebookPen className="size-5" /></div>
          <p className="text-[12px] leading-relaxed text-secondary-foreground">ふたりのアイデアや気になることを、<br />ここに残していこう。</p>
        </div>
      </div>
      <p className="text-center text-[11px] text-muted-foreground/80">Phase 1A ・ サンプルデータで表示中</p>

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
