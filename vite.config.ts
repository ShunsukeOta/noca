import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  build: {
    manifest: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, "/")
          if (normalizedId.includes("/src/features/workspace/workspace-membership.tsx")) return "workspace-membership"
          if (normalizedId.includes("/node_modules/@firebase/auth/") || normalizedId.includes("/node_modules/firebase/auth/")) return "firebase-auth-sdk"
          if (normalizedId.includes("/node_modules/@firebase/firestore/") || normalizedId.includes("/node_modules/firebase/firestore/")) return "firebase-firestore-sdk"
        }
      }
    }
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "noca",
        short_name: "noca",
        description: "TODO・カレンダー・メモ",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#f6f8fb",
        theme_color: "#f6f8fb",
        shortcuts: [
          {
            name: "TODOを追加",
            short_name: "TODO追加",
            description: "新しいTODOをすぐに作成",
            url: "/todo?shortcut=add-todo"
          },
          {
            name: "今日の予定",
            short_name: "今日の予定",
            description: "今日の予定を確認",
            url: "/calendar?shortcut=today"
          }
        ],
        icons: [
          { src: "/noca-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ]
      },
      workbox: {
        importScripts: ["/push-handler.js"],
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,webp}"],
        // Keep Firebase and the rarely used notification controls out of install downloads; cache after first online use.
        globIgnores: ["**/firebase-*-sdk-*.js", "**/firebase-workspace-*.js", "**/join-workspace-page-*.js", "**/notification-settings-*.js"],
        runtimeCaching: [
          {
            urlPattern: /\/assets\/notification-settings-[^/]+\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "noca-notification-ui-v1",
              expiration: { maxEntries: 2, maxAgeSeconds: 31_536_000 }
            }
          },
          {
            urlPattern: /\/assets\/(?:firebase-(?:auth|firestore)-sdk|firebase-workspace-)[^/]+\.js$/,
            handler: "CacheFirst",
            options: {
              cacheName: "noca-firebase-runtime-v1",
              expiration: { maxEntries: 20, maxAgeSeconds: 31_536_000 }
            }
          }
        ],
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }
})
