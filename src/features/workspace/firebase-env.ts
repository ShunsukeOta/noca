const firebaseValues = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
}

export const isFirebaseConfigured = Object.values(firebaseValues).every(value => typeof value === "string" && value.trim().length > 0)

export function getFirebaseConfig() {
  if (!isFirebaseConfigured) throw new Error("Firebaseの環境設定がありません。")
  return {
    ...firebaseValues,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || undefined
  }
}
