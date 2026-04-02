// Eagerly import all built-in providers so they self-register at startup.
// This runs before any request handler, avoiding import-order issues.
import { claudeCodeProvider } from "~~/server/providers/claude-code";
import { registerProvider } from "~~/server/providers/registry";

// Self-register on import
registerProvider(claudeCodeProvider);

export default defineNitroPlugin(() => {});
