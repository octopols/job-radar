import { createRivetKit } from "@rivetkit/react";
import type { ActorConn } from "rivetkit/client";
import type { seeker } from "../../backend/actors/seeker/index.ts";
import type { Registry } from "../../backend/registry.ts";
import "./desktop.ts";

const ENDPOINT = window.jobRadarDesktop?.endpoint || "http://127.0.0.1:6420";
const LOCAL_PROFILE_ID = "local";
const LEGACY_SEEKER_ID_KEY = "job-radar-seeker-id";

export const { useActor } = createRivetKit<Registry>({ endpoint: ENDPOINT, devtools: !window.jobRadarDesktop });

export type SeekerConnection = ActorConn<typeof seeker>;
export type Guard = (work: () => Promise<unknown>) => Promise<void>;

export function profileId(): string {
	try {
		return localStorage.getItem(LEGACY_SEEKER_ID_KEY) ?? LOCAL_PROFILE_ID;
	} catch {
		return LOCAL_PROFILE_ID;
	}
}

export function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
