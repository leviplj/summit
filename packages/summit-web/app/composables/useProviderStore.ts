import type { ProviderModel } from "summit-types";

export interface ProviderInfo {
  name: string;
  models: ProviderModel[];
}

export function useProviderStore() {
  const providers = useState<ProviderInfo[]>("providers", () => []);
  const loaded = useState("providers:loaded", () => false);

  async function loadProviders() {
    if (loaded.value) return;
    try {
      providers.value = await $fetch<ProviderInfo[]>("/api/providers");
    } finally {
      loaded.value = true;
    }
  }

  function getProvider(name: string): ProviderInfo | undefined {
    return providers.value.find((p) => p.name === name);
  }

  function modelsFor(providerName: string): ProviderModel[] {
    return getProvider(providerName)?.models ?? [];
  }

  function defaultModelFor(providerName: string): string | null {
    const models = modelsFor(providerName);
    return models.find((m) => m.default)?.id ?? models[0]?.id ?? null;
  }

  return {
    providers,
    loaded,
    loadProviders,
    getProvider,
    modelsFor,
    defaultModelFor,
  };
}
