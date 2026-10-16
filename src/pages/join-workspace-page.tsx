import { useState } from "react"
import { useLocation, useNavigate, useParams } from "react-router-dom"
import { ArrowRight, Check, LoaderCircle, UsersRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { isFirebaseConfigured } from "@/features/workspace/firebase-env"
import { useWorkspaceMembership } from "@/features/workspace/workspace-membership"
import { workspaceErrorMessage } from "@/features/workspace/workspace-errors"

const PENDING_INVITE_TOKEN_KEY = "noca.pending-invite-token"

export function JoinWorkspacePage() {
  const { token: pathToken = "" } = useParams()
  const location = useLocation()
  const token = pathToken || location.hash.slice(1) || readPendingInviteToken()
  const navigate = useNavigate()
  const { authStatus, authUser, workspaceStatus, signInWithGoogle, acceptInvite, authError } = useWorkspaceMembership()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [joined, setJoined] = useState(false)

  const handleSignIn = async () => {
    setBusy(true)
    setMessage("")
    try {
      if (token) savePendingInviteToken(token)
      await signInWithGoogle()
    } catch (error) {
      setMessage(workspaceErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const handleJoin = async () => {
    setBusy(true)
    setMessage("")
    try {
      if (!token) throw new Error("招待リンクを確認できませんでした。招待した人から新しいリンクを受け取ってください。")
      await acceptInvite(token)
      clearPendingInviteToken()
      setJoined(true)
      window.setTimeout(() => navigate("/todo", { replace: true }), 450)
    } catch (error) {
      setMessage(workspaceErrorMessage(error))
      setBusy(false)
    }
  }

  return (
    <section data-testid="join-workspace-page" className="mx-auto flex min-h-[65vh] max-w-sm flex-col items-center justify-center text-center">
      <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        {joined ? <Check className="size-7 text-success" /> : <UsersRound className="size-7" />}
      </span>
      <h1 className="text-[21px] font-bold tracking-[-.03em]">{joined ? "参加しました" : "共有スペースへの招待"}</h1>
      <p className="mt-2 max-w-[28ch] text-[13px] leading-relaxed text-muted-foreground">
        {joined
          ? "メンバー設定が反映されました。TODO・予定の共有同期は次の開発段階で追加します。"
          : token
            ? "招待を受け入れるにはGoogleでログインしてください。リンクは1回だけ使用できます。"
            : "招待リンクを確認できません。招待した人から新しいリンクを受け取ってください。"}
      </p>

      {!isFirebaseConfigured ? (
        <p role="status" className="mt-6 rounded-xl bg-secondary px-4 py-3 text-[13px] text-muted-foreground">
          招待機能の接続設定がまだ完了していません。
        </p>
      ) : joined ? (
        <Button type="button" className="mt-6 min-h-11 w-full rounded-xl" onClick={() => navigate("/todo", { replace: true })}>
          TODOへ進む <ArrowRight className="size-4" />
        </Button>
      ) : authStatus === "loading" || workspaceStatus === "loading" ? (
        <div role="status" className="mt-6 flex items-center gap-2 text-[13px] text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> アカウントを確認しています
        </div>
      ) : authUser && token ? (
        <div className="mt-6 w-full space-y-3">
          <p className="text-[12px] text-muted-foreground">{authUser.displayName} としてログイン中</p>
          <Button type="button" className="min-h-11 w-full rounded-xl" disabled={busy} onClick={handleJoin}>
            {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <UsersRound className="size-4" />}
            招待を受け入れる
          </Button>
        </div>
      ) : !authUser ? (
        <Button type="button" className="mt-6 min-h-11 w-full rounded-xl" disabled={busy} onClick={handleSignIn}>
          {busy ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <ArrowRight className="size-4" />}
          Googleでログインして参加
        </Button>
      ) : null}

      {(message || authError) && !joined && <p role="alert" className="mt-4 text-[12px] leading-relaxed text-destructive">{message || authError}</p>}
    </section>
  )
}

function readPendingInviteToken() {
  try {
    return sessionStorage.getItem(PENDING_INVITE_TOKEN_KEY) || ""
  } catch {
    return ""
  }
}

function savePendingInviteToken(token: string) {
  try {
    sessionStorage.setItem(PENDING_INVITE_TOKEN_KEY, token)
  } catch {
    // The original invite URL fragment still provides the token when storage is unavailable.
  }
}

function clearPendingInviteToken() {
  try {
    sessionStorage.removeItem(PENDING_INVITE_TOKEN_KEY)
  } catch {
    // The token can expire naturally if session storage is unavailable.
  }
}
