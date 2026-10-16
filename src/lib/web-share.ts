export type InviteShareResult = "shared" | "cancelled" | "unsupported" | "failed"
export type NativeShareHandler = (data: ShareData) => Promise<void>

export function supportsNativeShare() {
  return typeof navigator !== "undefined" && typeof navigator.share === "function"
}

export async function shareInviteUrl(url: string, share?: NativeShareHandler): Promise<InviteShareResult> {
  const nativeShare = share ?? (supportsNativeShare() ? navigator.share.bind(navigator) : undefined)
  if (!nativeShare) return "unsupported"

  const data: ShareData = {
    title: "nocaへの招待",
    text: "nocaの共有スペースに招待します。",
    url
  }

  try {
    if (!share && navigator.canShare && !navigator.canShare(data)) return "unsupported"
    await nativeShare(data)
    return "shared"
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return "cancelled"
    return "failed"
  }
}
