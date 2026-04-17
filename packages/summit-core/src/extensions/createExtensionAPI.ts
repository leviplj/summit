import { registerProvider } from "../providers";
import type { ExtensionAPI } from "./types";

export function createExtensionAPI(
  name: string,
  shutdownHooks: Array<() => void | Promise<void>>,
): ExtensionAPI {
  return {
    name,
    log(message: string) {
      console.log(`[ext:${name}] ${message}`);
    },
    onShutdown(callback) {
      shutdownHooks.push(callback);
    },
    providers: {
      register: registerProvider,
    },
  };
}
