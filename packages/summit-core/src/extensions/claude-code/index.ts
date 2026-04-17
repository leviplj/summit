import type { ExtensionFactory } from "../types";
import { claudeCodeProvider } from "./provider";

const extension: ExtensionFactory = (api) => {
  api.providers.register(claudeCodeProvider);
};

export default extension;
