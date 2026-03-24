export default defineNuxtConfig({
  compatibilityDate: "2025-01-01",
  future: { compatibilityVersion: 4 },
  ssr: false,
  modules: ["shadcn-nuxt", "@nuxtjs/tailwindcss", "@nuxtjs/color-mode"],
  shadcn: { prefix: "", componentDir: "./app/components/ui" },
  colorMode: { classSuffix: "" },
  nitro: {
    experimental: { websocket: true },
  },
});
