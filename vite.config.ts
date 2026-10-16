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
        icons: [
          { src: "/noca-icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
        ]
      },
      workbox: {
        navigateFallback: "/index.html",
        globPatterns: ["**/*.{js,css,html,ico,png,webp}"],
        // Keep Firebase code out of installation precache, then retain its hashed chunks after first online use.
        globIgnores: ["**/firebase-*-sdk-*.js", "**/firebase-workspace-*.js", "**/join-workspace-page-*.js"],
        runtimeCaching: [
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
