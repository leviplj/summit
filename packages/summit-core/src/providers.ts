import type { AgentProvider } from "summit-types";

const providers = new Map<string, AgentProvider>();

export function registerProvider(provider: AgentProvider): void {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): AgentProvider | undefined {
  return providers.get(name);
}

export function listProviders(): AgentProvider[] {
  return Array.from(providers.values());
}
