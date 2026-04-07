import { readFile, writeFile, readdir, unlink, mkdir, appendFile } from "fs/promises";
import { join } from "path";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createJsonStore<T extends { id: string }>(dir: string) {
  let dirEnsured = false;

  async function ensureDir() {
    if (dirEnsured) return;
    await mkdir(dir, { recursive: true });
    dirEnsured = true;
  }

  function validateId(id: string): void {
    if (!UUID_RE.test(id)) {
      throw new Error(`Invalid ID: ${id}`);
    }
  }

  function filePath(id: string) {
    return join(dir, `${id}.json`);
  }

  return {
    async list(): Promise<T[]> {
      await ensureDir();
      const files = await readdir(dir);
      const items = await Promise.all(
        files
          .filter((f) => f.endsWith(".json"))
          .map(async (f) => {
            try {
              const data = await readFile(join(dir, f), "utf-8");
              return JSON.parse(data) as T;
            } catch {
              return null;
            }
          }),
      );
      return items.filter((item): item is T => item !== null);
    },

    async get(id: string): Promise<T | null> {
      validateId(id);
      try {
        const data = await readFile(filePath(id), "utf-8");
        return JSON.parse(data);
      } catch {
        return null;
      }
    },

    async save(item: T): Promise<void> {
      validateId(item.id);
      await ensureDir();
      await writeFile(filePath(item.id), JSON.stringify(item, null, 2));
    },

    async remove(id: string): Promise<void> {
      validateId(id);
      await unlink(filePath(id));
    },
  };
}

export function createJsonlStore(filePath: string) {
  let dirEnsured = false;

  async function ensureDir() {
    if (dirEnsured) return;
    const dir = filePath.substring(0, filePath.lastIndexOf("/"));
    await mkdir(dir, { recursive: true });
    dirEnsured = true;
  }

  return {
    async append<T>(entry: T): Promise<void> {
      await ensureDir();
      await appendFile(filePath, JSON.stringify(entry) + "\n");
    },

    async readAll<T>(): Promise<T[]> {
      try {
        const data = await readFile(filePath, "utf-8");
        return data
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
          .map((line) => JSON.parse(line) as T);
      } catch {
        return [];
      }
    },
  };
}
