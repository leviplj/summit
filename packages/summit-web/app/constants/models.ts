export interface ModelOption {
  id: string;
  label: string;
}

export const LATEST_MODELS: ModelOption[] = [
  { id: "claude-opus-4-6", label: "Opus 4.6" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-4-6";
