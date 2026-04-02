import { loadExtensions } from "~~/server/extensions/loader";

export default defineNitroPlugin(async (nitro) => {
  const shutdownHooks = await loadExtensions();

  nitro.hooks.hook("close", async () => {
    const results = await Promise.allSettled(
      shutdownHooks.map((hook) => hook()),
    );
    for (const result of results) {
      if (result.status === "rejected") {
        console.warn("[extensions] Shutdown hook error:", result.reason);
      }
    }
  });
});
