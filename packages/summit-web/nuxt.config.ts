import tailwindcss from "@tailwindcss/vite";

export default defineNuxtConfig({
  compatibilityDate: "2025-07-15",
  future: { compatibilityVersion: 4 },
  ssr: false,
  app: {
    head: {
      link: [{ rel: "icon", type: "image/png", href: "/favicon.png" }],
    },
  },
  css: ["~/assets/main.css"],
  modules: ["shadcn-nuxt", "@nuxtjs/color-mode"],
  shadcn: { prefix: "", componentDir: "./app/components/ui" },
  colorMode: { classSuffix: "" },
  vite: {
    plugins: [tailwindcss()],
  },
});
