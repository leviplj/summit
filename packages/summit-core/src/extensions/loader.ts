import { createExtensionAPI } from "./createExtensionAPI";
import type { ExtensionFactory } from "./types";
import claudeCodeExtension from "./claude-code";

interface BundledEntry {
  name: string;
  factory: ExtensionFactory;
}

const BUNDLED: BundledEntry[] = [
  { name: "claude-code", factory: claudeCodeExtension },
];

let loaded = false;
const shutdownHooks: Array<() => void | Promise<void>> = [];

export async function loadExtensions(): Promise<void> {
  if (loaded) return;
  loaded = true;

  for (const entry of BUNDLED) {
    try {
      const api = createExtensionAPI(entry.name, shutdownHooks);
      await entry.factory(api);
      api.log("loaded");
    } catch (err: any) {
      console.warn(`[extensions] Failed to load ${entry.name}: ${err.message}`);
    }
  }
}

export async function shutdownExtensions(): Promise<void> {
  for (const hook of shutdownHooks) {
    try {
      await hook();
    } catch (err: any) {
      console.warn(`[extensions] shutdown error: ${err.message}`);
    }
  }
  shutdownHooks.length = 0;
  loaded = false;
}
