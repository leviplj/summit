import type { AgentProvider } from "./types";

const providers = new Map<string, AgentProvider>();

export function registerProvider(provider: AgentProvider) {
  providers.set(provider.name, provider);
}

export function getProvider(name: string): AgentProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw new Error(`Unknown provider: "${name}". Available: ${Array.from(providers.keys()).join(", ")}`);
  }
  return provider;
}

export function listProviders(): AgentProvider[] {
  return Array.from(providers.values());
}
