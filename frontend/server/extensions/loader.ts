import { readdir } from "fs/promises";
import { join, basename } from "path";
import { homedir } from "os";
import { createExtensionAPI } from "./createExtensionAPI";
import type { ExtensionFactory } from "./types";

// Bundled extensions are statically imported since Nitro bundles everything
import discordExtension from "./discord";
import claudeCodeExtension from "./claude-code";

interface ExtensionEntry {
  name: string;
  factory: ExtensionFactory;
}

interface DiscoveredEntry {
  name: string;
  path: string;
}

const PROJECT_DIR = join(process.cwd(), ".summit", "extensions");
const GLOBAL_DIR = join(homedir(), ".summit", "extensions");

const BUNDLED: ExtensionEntry[] = [
  { name: "claude-code", factory: claudeCodeExtension },
  { name: "discord", factory: discordExtension },
];

async function listFiles(dir: string, ext: string[]): Promise<string[]> {
  try {
    const entries = await readdir(dir);
    return entries.filter((f) => ext.some((e) => f.endsWith(e)));
  } catch {
    return [];
  }
}

async function discoverUserExtensions(): Promise<DiscoveredEntry[]> {
  const extensions: DiscoveredEntry[] = [];

  // Project-local extensions
  const projectFiles = await listFiles(PROJECT_DIR, [".ts", ".js"]);
  for (const file of projectFiles.sort()) {
    const name = basename(file).replace(/\.(ts|js)$/, "");
    extensions.push({ name, path: join(PROJECT_DIR, file) });
  }

  // Global user extensions
  const globalFiles = await listFiles(GLOBAL_DIR, [".ts", ".js"]);
  for (const file of globalFiles.sort()) {
    const name = basename(file).replace(/\.(ts|js)$/, "");
    extensions.push({ name, path: join(GLOBAL_DIR, file) });
  }

  return extensions;
}

export async function loadExtensions(): Promise<Array<() => void | Promise<void>>> {
  const shutdownHooks: Array<() => void | Promise<void>> = [];

  // Load bundled extensions first
  for (const entry of BUNDLED) {
    try {
      const api = createExtensionAPI(entry.name, shutdownHooks);
      await entry.factory(api);
      api.log("loaded");
    } catch (err: any) {
      console.warn(`[extensions] Failed to load bundled ${entry.name}: ${err.message}`);
    }
  }

  // Discover and load user extensions
  const userExtensions = await discoverUserExtensions();
  for (const entry of userExtensions) {
    try {
      const mod = await import(entry.path);
      const factory: ExtensionFactory = mod.default ?? mod;

      if (typeof factory !== "function") {
        console.warn(`[extensions] ${entry.name}: default export is not a function, skipping`);
        continue;
      }

      const api = createExtensionAPI(entry.name, shutdownHooks);
      await factory(api);
      api.log("loaded");
    } catch (err: any) {
      console.warn(`[extensions] Failed to load ${entry.name}: ${err.message}`);
    }
  }

  return shutdownHooks;
}
