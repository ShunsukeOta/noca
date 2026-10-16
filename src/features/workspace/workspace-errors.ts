export function workspaceErrorMessage(error: unknown) {
  if (error instanceof Error && error.name === "WorkspaceActionError" && error.message) return error.message

  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : ""
  if (code === "auth/unauthorized-domain") return "このURLをFirebaseの認証許可ドメインに追加してください。"
  if (code === "auth/operation-not-allowed") return "Firebase ConsoleでGoogleログインを有効にしてください。"
  if (code === "auth/invalid-api-key") return "Firebaseの環境設定を確認してください。"
  if (code === "permission-denied" || code === "firestore/permission-denied") return "共有スペースへのアクセスが許可されませんでした。Firestoreルールを確認してください。"
  if (code === "unavailable" || code === "auth/network-request-failed") return "通信できませんでした。ネットワークを確認してもう一度お試しください。"
  return "操作を完了できませんでした。設定と通信を確認して、もう一度お試しください。"
}
