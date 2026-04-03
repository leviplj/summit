import type { ProviderModel } from "summit-types";

export const LATEST_MODELS: ProviderModel[] = [
  { id: "claude-opus-4-6", label: "Opus 4.6", default: true },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

export const LEGACY_MODELS: ProviderModel[] = [
  { id: "claude-opus-4-5-20251101", label: "Opus 4.5" },
  { id: "claude-opus-4-1-20250805", label: "Opus 4.1" },
  { id: "claude-opus-4-20250514", label: "Opus 4" },
  { id: "claude-sonnet-4-5-20250929", label: "Sonnet 4.5" },
  { id: "claude-sonnet-4-20250514", label: "Sonnet 4" },
];

export const ALL_MODELS: ProviderModel[] = [...LATEST_MODELS, ...LEGACY_MODELS];
