import type { createClient } from "rivetkit/client";
import type { CareerAssistant } from "../../../backend/ai/career-assistant.ts";
import type { Registry } from "../../../backend/registry.ts";
import type { AutoApplyOutcome } from "../../../shared/types/application.ts";
import type { ApplicationStatus } from "../../../shared/ipc/apply.ts";

export type SeekerClient = ReturnType<typeof createClient<Registry>>;
export type SeekerHandle = ReturnType<SeekerClient["seeker"]["getOrCreate"]>;
export type StatusListener = (status: ApplicationStatus) => void;
export type Assistant = Pick<CareerAssistant, "findApplyTarget">;

export interface AutoApplyResult {
	outcome: AutoApplyOutcome;
	note: string | null;
}

export interface SessionMode {
	auto: boolean;
	autoSubmit: boolean;
}

export class Pause {
	static for(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
