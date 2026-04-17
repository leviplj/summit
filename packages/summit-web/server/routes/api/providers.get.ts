import { listProviders } from "summit-core";

export default defineEventHandler(() => {
  return listProviders().map((p) => ({
    name: p.name,
    models: p.models,
  }));
});
