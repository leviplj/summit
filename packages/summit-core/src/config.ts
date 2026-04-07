import { join } from "path";

let storePath = join(process.cwd(), ".summit");

export function init(options: { storePath?: string }) {
  if (options.storePath) {
    storePath = options.storePath;
  }
}

export function getStorePath(): string {
  return storePath;
}