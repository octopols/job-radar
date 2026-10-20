export type AiKind = "claude-code" | "anthropic-api";

export interface AiSettings {
	kind: AiKind;
	apiKey: string | null;
}
