import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { VitePWA } from "vite-plugin-pwa"
import { fileURLToPath, URL } from "node:url"

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["noca-icon.svg"],
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
        globPatterns: ["**/*.{js,css,html,svg,ico,png,webp}"],
        cleanupOutdatedCaches: true
      },
      devOptions: { enabled: false }
    })
  ],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } }
})
