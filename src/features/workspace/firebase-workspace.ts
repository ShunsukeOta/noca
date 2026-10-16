import { getApp, getApps, initializeApp } from "firebase/app"
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User
} from "firebase/auth"
import {
  collection,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  Timestamp,
  type DocumentData
} from "firebase/firestore"
import { getFirebaseConfig } from "@/features/workspace/firebase-env"

export type SignedInProfile = {
  uid: string
  displayName: string
  email: string | null
  photoURL: string | null
}

export type RemoteWorkspaceMember = SignedInProfile & {
  id: "A" | "B"
  role: "owner" | "member"
}

export type RemoteWorkspace = {
  id: string
  ownerUid: string
  activeInviteHash: string | null
  members: RemoteWorkspaceMember[]
}

export type CreatedInvite = { url: string; expiresAt: Date }

export type WorkspaceActionErrorCode =
  | "not-authenticated"
  | "already-in-workspace"
  | "workspace-not-found"
  | "workspace-full"
  | "invite-not-found"
  | "invite-expired"
  | "invite-used"
  | "invite-revoked"
  | "invite-owner-only"
  | "unsupported-browser"

export class WorkspaceActionError extends Error {
  constructor(readonly code: WorkspaceActionErrorCode, message: string) {
    super(message)
    this.name = "WorkspaceActionError"
  }
}

function getServices() {
  const app = getApps().length > 0 ? getApp() : initializeApp(getFirebaseConfig())
  return { auth: getAuth(app), db: getFirestore(app) }
}

export function observeAuth(onUser: (user: SignedInProfile | null) => void, onError: (error: Error) => void): () => void {
  const { auth } = getServices()
  return onAuthStateChanged(auth, user => onUser(user ? toProfile(user) : null), onError)
}

export async function resolveRedirectResult() {
  const { auth } = getServices()
  await getRedirectResult(auth)
}

export async function signInWithGoogle() {
  const { auth } = getServices()
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: "select_account" })
  await signInWithPopup(auth, provider)
}

export async function signOut() {
  const { auth } = getServices()
  await firebaseSignOut(auth)
}

export function observeWorkspace(
  uid: string,
  onWorkspace: (workspace: RemoteWorkspace | null, fromCache: boolean) => void,
  onError: (error: Error) => void
): () => void {
  const { db } = getServices()
  let unsubscribeWorkspace: (() => void) | undefined

  const unsubscribeUser = onSnapshot(doc(db, "users", uid), userSnapshot => {
    unsubscribeWorkspace?.()
    unsubscribeWorkspace = undefined
    let userFromCache = userSnapshot.metadata.fromCache

    const workspaceId = userSnapshot.data()?.workspaceId
    if (typeof workspaceId !== "string" || workspaceId.length === 0) {
      onWorkspace(null, userSnapshot.metadata.fromCache)
      return
    }

    const workspaceRef = doc(db, "workspaces", workspaceId)
    let currentWorkspace: DocumentData | undefined
    let currentMembers: RemoteWorkspaceMember[] | null = null
    let workspaceFromCache = true
    let membersFromCache = true
    const emit = () => {
      if (!currentWorkspace || !currentMembers) return
      onWorkspace({
        id: workspaceId,
        ownerUid: currentWorkspace.ownerUid,
        activeInviteHash: typeof currentWorkspace.activeInviteHash === "string" ? currentWorkspace.activeInviteHash : null,
        members: currentMembers
      }, userFromCache || workspaceFromCache || membersFromCache)
    }

    const unsubscribeWorkspaceDoc = onSnapshot(workspaceRef, snapshot => {
      if (!snapshot.exists()) {
        currentWorkspace = undefined
        workspaceFromCache = snapshot.metadata.fromCache
        if (userFromCache || workspaceFromCache) onWorkspace(null, true)
        else onError(new Error("共有スペースが見つかりません。"))
        return
      }
      currentWorkspace = snapshot.data()
      workspaceFromCache = snapshot.metadata.fromCache
      emit()
    }, onError)

    const unsubscribeMembers = onSnapshot(collection(workspaceRef, "members"), snapshot => {
      currentMembers = snapshot.docs
        .map(memberSnapshot => toWorkspaceMember(memberSnapshot.id, memberSnapshot.data()))
        .filter((member): member is RemoteWorkspaceMember => member !== null)
        .sort((left, right) => left.id.localeCompare(right.id))
      membersFromCache = snapshot.metadata.fromCache
      emit()
    }, onError)

    unsubscribeWorkspace = () => {
      unsubscribeWorkspaceDoc()
      unsubscribeMembers()
    }
  }, onError)

  return () => {
    unsubscribeUser()
    unsubscribeWorkspace?.()
  }
}

export async function createWorkspace() {
  const { auth, db } = getServices()
  const user = auth.currentUser
  if (!user) throw new WorkspaceActionError("not-authenticated", "先にGoogleでログインしてください。")

  const userRef = doc(db, "users", user.uid)
  const workspaceRef = doc(collection(db, "workspaces"))
  const memberRef = doc(db, "workspaces", workspaceRef.id, "members", user.uid)

  await runTransaction(db, async transaction => {
    const userSnapshot = await transaction.get(userRef)
    if (userSnapshot.exists() && typeof userSnapshot.data().workspaceId === "string") {
      throw new WorkspaceActionError("already-in-workspace", "すでに共有スペースへ参加しています。")
    }
    transaction.set(workspaceRef, {
      ownerUid: user.uid,
      memberUids: [user.uid],
      activeInviteHash: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })
    transaction.set(memberRef, { ...toProfile(user), slot: "A", role: "owner", joinedAt: serverTimestamp() })
    transaction.set(userRef, { workspaceId: workspaceRef.id, createdAt: serverTimestamp() })
  })
}

export async function createInvite(): Promise<CreatedInvite> {
  const { auth, db } = getServices()
  const user = auth.currentUser
  if (!user) throw new WorkspaceActionError("not-authenticated", "先にGoogleでログインしてください。")

  const userSnapshot = await getDoc(doc(db, "users", user.uid))
  const workspaceId = userSnapshot.data()?.workspaceId
  if (typeof workspaceId !== "string") throw new WorkspaceActionError("workspace-not-found", "共有スペースを先に作成してください。")

  const workspaceRef = doc(db, "workspaces", workspaceId)
  const token = createInviteToken()
  const tokenHash = await hashInviteToken(token)
  const inviteRef = doc(db, "invitations", tokenHash)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000 - 60 * 1000)

  await runTransaction(db, async transaction => {
    const workspaceSnapshot = await transaction.get(workspaceRef)
    if (!workspaceSnapshot.exists()) throw new WorkspaceActionError("workspace-not-found", "共有スペースが見つかりません。")
    const workspace = workspaceSnapshot.data()
    if (workspace.ownerUid !== user.uid) throw new WorkspaceActionError("invite-owner-only", "招待リンクを作成できるのはスペースの作成者です。")
    if (!Array.isArray(workspace.memberUids) || workspace.memberUids.length !== 1) {
      throw new WorkspaceActionError("workspace-full", "この共有スペースはすでに2人で利用しています。")
    }

    const previousHash = typeof workspace.activeInviteHash === "string" ? workspace.activeInviteHash : null
    const previousInviteRef = previousHash ? doc(db, "invitations", previousHash) : null
    const previousInviteSnapshot = previousInviteRef ? await transaction.get(previousInviteRef) : null

    if (previousInviteRef && previousInviteSnapshot?.exists() && previousInviteSnapshot.data().status === "pending") {
      transaction.update(previousInviteRef, { status: "revoked", revokedAt: serverTimestamp() })
    }
    transaction.set(inviteRef, {
      workspaceId,
      createdBy: user.uid,
      status: "pending",
      createdAt: serverTimestamp(),
      expiresAt: Timestamp.fromDate(expiresAt),
      acceptedBy: null
    })
    transaction.update(workspaceRef, { activeInviteHash: tokenHash, updatedAt: serverTimestamp() })
  })

  return { url: `${window.location.origin}/join#${token}`, expiresAt }
}

export async function acceptInvite(token: string) {
  const { auth, db } = getServices()
  const user = auth.currentUser
  if (!user) throw new WorkspaceActionError("not-authenticated", "先にGoogleでログインしてください。")

  const tokenHash = await hashInviteToken(token)
  const inviteRef = doc(db, "invitations", tokenHash)
  const userRef = doc(db, "users", user.uid)

  await runTransaction(db, async transaction => {
    const [inviteSnapshot, userSnapshot] = await Promise.all([transaction.get(inviteRef), transaction.get(userRef)])
    if (!inviteSnapshot.exists()) throw new WorkspaceActionError("invite-not-found", "この招待リンクは無効です。")
    const invite = inviteSnapshot.data()
    if (invite.status === "revoked") throw new WorkspaceActionError("invite-revoked", "この招待リンクは無効です。新しいリンクを発行してください。")
    if (invite.status !== "pending") throw new WorkspaceActionError("invite-used", "この招待リンクはすでに使用されています。")
    if (!(invite.expiresAt instanceof Timestamp) || invite.expiresAt.toMillis() <= Date.now()) {
      throw new WorkspaceActionError("invite-expired", "この招待リンクの有効期限が切れています。")
    }
    if (userSnapshot.exists() && typeof userSnapshot.data().workspaceId === "string") {
      if (userSnapshot.data().workspaceId === invite.workspaceId) {
        throw new WorkspaceActionError("already-in-workspace", "すでにこの共有スペースへ参加しています。")
      }
      throw new WorkspaceActionError("already-in-workspace", "すでに別の共有スペースへ参加しています。")
    }

    const workspaceRef = doc(db, "workspaces", invite.workspaceId)
    const workspaceSnapshot = await transaction.get(workspaceRef)
    if (!workspaceSnapshot.exists()) throw new WorkspaceActionError("workspace-not-found", "共有スペースが見つかりません。")
    const workspace = workspaceSnapshot.data()
    if (workspace.activeInviteHash !== tokenHash || !Array.isArray(workspace.memberUids) || workspace.memberUids.length !== 1) {
      throw new WorkspaceActionError("workspace-full", "この招待は現在利用できません。")
    }

    const memberRef = doc(db, "workspaces", invite.workspaceId, "members", user.uid)
    transaction.set(memberRef, { ...toProfile(user), slot: "B", role: "member", joinedAt: serverTimestamp() })
    transaction.update(workspaceRef, {
      memberUids: [workspace.ownerUid, user.uid],
      activeInviteHash: null,
      updatedAt: serverTimestamp()
    })
    transaction.update(inviteRef, { status: "accepted", acceptedBy: user.uid, acceptedAt: serverTimestamp() })
    transaction.set(userRef, { workspaceId: invite.workspaceId, createdAt: serverTimestamp() })
  })
}

function toProfile(user: User): SignedInProfile {
  return {
    uid: user.uid,
    displayName: user.displayName?.trim() || "自分",
    email: user.email,
    photoURL: user.photoURL
  }
}

function toWorkspaceMember(id: string, data: DocumentData): RemoteWorkspaceMember | null {
  if ((data.slot !== "A" && data.slot !== "B") || (data.role !== "owner" && data.role !== "member")) return null
  return {
    id: data.slot,
    uid: id,
    displayName: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName : "メンバー",
    email: typeof data.email === "string" ? data.email : null,
    photoURL: typeof data.photoURL === "string" ? data.photoURL : null,
    role: data.role
  }
}

function createInviteToken() {
  if (!globalThis.crypto?.getRandomValues) throw new WorkspaceActionError("unsupported-browser", "このブラウザでは招待リンクを作成できません。")
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

async function hashInviteToken(token: string) {
  if (!globalThis.crypto?.subtle) throw new WorkspaceActionError("unsupported-browser", "安全な接続で開くと招待リンクを利用できます。")
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("")
}
