import { readFile, writeFile, readdir, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { access } from "fs/promises";
import type { Project } from "~~/shared/types";

export type { Project };

const exec = promisify(execFile);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECTS_DIR = join(process.cwd(), ".summit", "projects");

let dirEnsured = false;
async function ensureDir() {
  if (dirEnsured) return;
  await mkdir(PROJECTS_DIR, { recursive: true });
  dirEnsured = true;
}

function validateId(id: string): void {
  if (!UUID_RE.test(id)) {
    throw createError({ statusCode: 400, message: "Invalid project ID" });
  }
}

function projectPath(id: string) {
  return join(PROJECTS_DIR, `${id}.json`);
}

export async function validateRepoPath(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw createError({ statusCode: 400, message: `Path does not exist: ${path}` });
  }
  try {
    await exec("git", ["rev-parse", "--git-dir"], { cwd: path });
  } catch {
    throw createError({ statusCode: 400, message: `Not a git repository: ${path}` });
  }
}

export function validateRepoNames(repos: Array<{ name: string; path: string }>): void {
  const names = new Set<string>();
  for (const repo of repos) {
    if (names.has(repo.name)) {
      throw createError({ statusCode: 400, message: `Duplicate repo name: ${repo.name}` });
    }
    names.add(repo.name);
  }
}

export async function listProjects(): Promise<Project[]> {
  await ensureDir();
  const files = await readdir(PROJECTS_DIR);
  const projects = await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const data = await readFile(join(PROJECTS_DIR, f), "utf-8");
          return JSON.parse(data) as Project;
        } catch {
          return null;
        }
      }),
  );
  return projects
    .filter((p): p is Project => p !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getProject(id: string): Promise<Project | null> {
  validateId(id);
  try {
    const data = await readFile(projectPath(id), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function saveProject(project: Project): Promise<void> {
  validateId(project.id);
  await ensureDir();
  project.updatedAt = new Date().toISOString();
  await writeFile(projectPath(project.id), JSON.stringify(project, null, 2));
}

export async function deleteProjectFile(id: string): Promise<void> {
  validateId(id);
  try {
    await unlink(projectPath(id));
  } catch {
    throw createError({ statusCode: 404, message: "Project not found" });
  }
}
