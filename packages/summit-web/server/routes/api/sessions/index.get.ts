import { listSessions } from "summit-core";

export default defineEventHandler((event) => {
  const query = getQuery(event);
  const projectId = typeof query.projectId === "string" ? query.projectId : undefined;
  return listSessions(projectId);
});
