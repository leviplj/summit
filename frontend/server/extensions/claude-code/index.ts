import { claudeCodeProvider } from "~~/server/providers/claude-code";
import type { ExtensionFactory } from "../types";

const extension: ExtensionFactory = (api) => {
  api.providers.register(claudeCodeProvider);
};

export default extension;
