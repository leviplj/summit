import type { AgentProvider } from "summit-types";

export interface ExtensionAPI {
  readonly name: string;
  log(message: string): void;
  onShutdown(callback: () => void | Promise<void>): void;
  providers: {
    register(provider: AgentProvider): void;
  };
}

export type ExtensionFactory = (api: ExtensionAPI) => void | Promise<void>;
