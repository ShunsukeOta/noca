import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type Owner = "A" | "B" | "both"

export const ownerLabel: Record<Owner, string> = {
  A: "A",
  B: "B",
  both: "ふたり"
}

export const ownerAvatarTone: Record<Owner, string> = {
  A: "bg-owner-a-avatar text-owner-a-avatar-foreground",
  B: "bg-owner-b-avatar text-owner-b-avatar-foreground",
  both: "bg-owner-both-avatar text-owner-both-avatar-foreground"
}

export const ownerSurfaceTone: Record<Owner, string> = {
  A: "border-owner-a-border bg-owner-a-surface text-owner-a-strong",
  B: "border-owner-b-border bg-owner-b-surface text-owner-b-strong",
  both: "border-owner-both-border bg-owner-both-surface text-owner-both-strong"
}

const avatarSize = {
  xs: "size-[17px] text-[9px]",
  sm: "size-6 text-[10px]",
  md: "size-7 text-[10px]",
  lg: "size-8 text-[10px]"
} as const

function OwnerAvatar({ owner, size = "sm", decorative = false, className }: {
  owner: Owner
  size?: keyof typeof avatarSize
  decorative?: boolean
  className?: string
}) {
  const content = owner === "both" ? "2" : owner
  return (
    <span
      data-slot="owner-avatar"
      data-owner={owner}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : owner === "both" ? "ふたり" : `担当 ${owner}`}
      aria-hidden={decorative ? true : undefined}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-bold", avatarSize[size], ownerAvatarTone[owner], className)}
    >
      {content}
    </span>
  )
}

function OwnerSelector({ value, onChange, className }: {
  value: Owner
  onChange: (owner: Owner) => void
  className?: string
}) {
  return (
    <div data-slot="owner-selector" role="group" aria-label="予定の担当" className={cn("grid grid-cols-3 gap-2", className)}>
      {(["A", "B", "both"] as const).map(owner => (
        <Button
          key={owner}
          type="button"
          variant="outline"
          aria-label={`${ownerLabel[owner]}の予定`}
          aria-pressed={value === owner}
          onClick={() => onChange(owner)}
          className={cn(
            "min-h-11 h-auto min-w-0 flex-col items-center justify-center gap-1 whitespace-normal rounded-md px-1 py-2 text-[11px] leading-tight",
            value === owner ? ownerSurfaceTone[owner] : "border-border bg-card text-muted-foreground"
          )}
        >
          <OwnerAvatar owner={owner} size="sm" decorative />
          <span className="max-w-full whitespace-normal break-words text-center">{ownerLabel[owner]}</span>
        </Button>
      ))}
    </div>
  )
}

export { OwnerAvatar, OwnerSelector }
