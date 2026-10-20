import { z } from "zod";
import { CountryResolver } from "../../shared/geo.ts";
import { type Profile, profileSchema, resumeProfileSchema } from "../../shared/types/profile.ts";

const legacyProfileSchema = resumeProfileSchema.extend({
	remoteOk: z.boolean().optional(),
	workModes: z.array(z.enum(["remote", "hybrid", "onsite"])).min(1).optional(),
	openToRelocation: z.boolean().default(false),
	workCountries: z.array(z.string()).optional(),
	excludeKeywords: z.array(z.string()).default([]),
});

export class ProfileMigration {
	static upgrade(raw: unknown): Profile {
		const current = profileSchema.safeParse(raw);
		if (current.success) {
			return current.data;
		}
		const { remoteOk, workModes, workCountries, ...rest } = legacyProfileSchema.parse(raw);
		return {
			...rest,
			workModes: workModes ?? (remoteOk === false ? ["hybrid", "onsite"] : ["remote", "hybrid", "onsite"]),
			workCountries: workCountries ?? CountryResolver.fromLocations(rest.locations),
		};
	}
}
