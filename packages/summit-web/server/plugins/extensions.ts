import { loadExtensions } from "summit-core";

export default defineNitroPlugin(async () => {
  await loadExtensions();
});
