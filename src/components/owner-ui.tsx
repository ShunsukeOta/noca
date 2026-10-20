import { useState } from "react"
import type { WorkspaceMember } from "@/features/workspace/workspace-membership"
import type { WorkspacePresenceStatus } from "@/features/workspace/workspace-presence-state"
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

function OwnerAvatar({ owner, size = "sm", decorative = false, className, label, photoURL, presenceStatus }: {
  owner: Owner
  size?: keyof typeof avatarSize
  decorative?: boolean
  className?: string
  label?: string
  photoURL?: string | null
  presenceStatus?: WorkspacePresenceStatus
}) {
  const content = label ? [...label][0] : owner === "both" ? "2" : owner
  const accessibleLabel = label ?? (owner === "both" ? "ふたり" : `担当 ${owner}`)
  const [failedPhotoURL, setFailedPhotoURL] = useState<string | null>(null)
  const activePhotoURL = photoURL && failedPhotoURL !== photoURL ? photoURL : null
  const presenceLabel = presenceStatus === "online" ? "オンライン" : presenceStatus === "offline" ? "オフライン" : "状態を確認中"
  return (
    <span
      data-slot="owner-avatar"
      data-owner={owner}
      data-presence-status={presenceStatus}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : presenceStatus ? `${accessibleLabel}、${presenceLabel}` : accessibleLabel}
      aria-hidden={decorative ? true : undefined}
      title={presenceStatus ? `${accessibleLabel}: ${presenceLabel}` : undefined}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-bold",
        avatarSize[size],
        ownerAvatarTone[owner],
        presenceStatus === "online" && "ring-2 ring-success ring-offset-1 ring-offset-background",
        presenceStatus === "offline" && "ring-2 ring-border ring-offset-1 ring-offset-background",
        className
      )}
    >
      {activePhotoURL && <img src={activePhotoURL} alt="" aria-hidden="true" className="absolute inset-0 size-full object-cover" onError={() => setFailedPhotoURL(activePhotoURL)} />}
      <span className={activePhotoURL ? "sr-only" : undefined}>{content}</span>
    </span>
  )
}

function OwnerSelector({ value, onChange, members, className }: {
  value: Owner
  onChange: (owner: Owner) => void
  members: WorkspaceMember[]
  className?: string
}) {
  return (
    <div data-slot="owner-selector" role="group" aria-label="予定の担当" className={cn("grid grid-cols-3 gap-2", className)}>
      {(["A", "B", "both"] as const).map(owner => (
        (() => {
          const member = owner === "both" ? undefined : members.find(item => item.id === owner)
          const label = member?.displayName ?? ownerLabel[owner]
          return (
            <Button
              key={owner}
              type="button"
              variant="outline"
              aria-label={`${label}の予定`}
              aria-pressed={value === owner}
              onClick={() => onChange(owner)}
              className={cn(
                "min-h-11 h-auto min-w-0 flex-col items-center justify-center gap-1 whitespace-normal rounded-md px-1 py-2 text-[11px] leading-tight",
                value === owner ? ownerSurfaceTone[owner] : "border-border bg-card text-muted-foreground"
              )}
            >
              <OwnerAvatar owner={owner} size="sm" decorative label={member?.displayName} photoURL={member?.photoURL} />
              <span className="max-w-full whitespace-normal break-words text-center">{label}</span>
            </Button>
          )
        })()
      ))}
    </div>
  )
}

export { OwnerAvatar, OwnerSelector }
