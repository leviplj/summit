import { devServerManager } from "~~/server/features/dev-server/manager";

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, "id")!;
  return devServerManager.getStatus(id);
});
