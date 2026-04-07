import { listProjects } from "summit-core";

export default defineEventHandler(() => {
  return listProjects();
});