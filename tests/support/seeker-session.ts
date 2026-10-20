import type { Profile } from "../../src/shared/types/profile.ts";
import type { SeekerSnapshot } from "../../src/shared/types/seeker.ts";

export const BACKEND_PROFILE: Profile = {
	headline: "Backend engineer",
	seniority: "mid",
	yearsExperience: 4,
	targetTitles: ["Backend Engineer"],
	skills: ["Go", "Kafka", "PostgreSQL"],
	locations: ["Bangalore"],
	workModes: ["remote", "hybrid", "onsite"],
	openToRelocation: false,
	workCountries: ["India"],
	excludeKeywords: [],
};

interface SnapshotSource {
	on(event: "snapshot", listener: (snapshot: SeekerSnapshot) => void): unknown;
}

export function nextSnapshot(seeker: SnapshotSource, predicate: (snapshot: SeekerSnapshot) => boolean): Promise<SeekerSnapshot> {
	return new Promise((resolve) => {
		seeker.on("snapshot", (snapshot: SeekerSnapshot) => {
			if (predicate(snapshot)) {
				resolve(snapshot);
			}
		});
	});
}

export function syncedWith(boardKey: string): (snapshot: SeekerSnapshot) => boolean {
	return (snapshot) => snapshot.follows.includes(boardKey) && snapshot.syncing.length === 0;
}
