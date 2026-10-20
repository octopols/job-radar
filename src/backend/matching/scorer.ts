import { GOOD_FIT_SCORE } from "../../shared/constants.ts";
import { CountryResolver } from "../../shared/geo.ts";
import type { Score } from "../../shared/types/match.ts";
import type { Posting, WorkMode } from "../../shared/types/posting.ts";
import { type Profile, SENIORITY_ORDER, type Seniority } from "../../shared/types/profile.ts";

export const MATCH_FLOOR = 40;

export const SCORER_VERSION = 5;

const TITLE_POINTS = 40;
const SKILL_POINTS = 35;
const SENIORITY_POINTS = 15;
const LOCATION_POINTS = 10;
const SENIORITY_MISMATCH_PENALTY = 25;

const RESTRICTED_REMOTE_PENALTY = 25;
const LOCATION_MISMATCH_PENALTY = 40;
const RELOCATION_PENALTY = 5;
const WORK_MODE_PENALTY = 15;
const NO_SPONSORSHIP_PENALTY = 40;
const SPONSORED_VISA_PENALTY = 5;
const ROLE_SHIFT_PENALTY = 30;
const TITLE_PRECISION_WEIGHT = 0.4;
const SKILLS_FOR_FULL_CREDIT = 6;
const SKILLS_SHOWN = 3;

const SENIORITY_PATTERNS: [Seniority, RegExp][] = [
	["intern", /\b(intern|internship|co-?op|apprentice)\b/i],
	["staff", /\b(staff|principal|distinguished|head of|director|vp|fellow|architect)\b/i],
	["senior", /\b(senior|sr\.?|lead)\b/i],
	["junior", /\b(junior|jr\.?|new grad|graduate|entry[- ]level)\b/i],
];

const SENIORITY_LABELS: Record<Seniority, string> = {
	intern: "an internship",
	junior: "junior",
	mid: "mid-level",
	senior: "senior",
	staff: "staff-level or above",
};

const WORK_MODE_LABELS: Record<WorkMode, string> = { remote: "Remote", hybrid: "Hybrid", onsite: "On-site" };

const UNRESTRICTED_REMOTE = /^(global|globally|anywhere|worldwide|international|first|friendly|ok)$/i;

const NO_SPONSORSHIP =
	/\b(unable|not able|cannot|can ?not|can't|do not|don't|does not|doesn't|will not|won't|are not able|is not able)\b[^.]{0,40}\bsponsor/i;
const OFFERS_SPONSORSHIP = /\b(visa sponsorship (is )?(available|provided|offered)|(we|will) sponsor (work )?visas?|sponsorship available)\b/i;

const ROLE_SHIFTS: { family: string; pattern: RegExp }[] = [
	{ family: "testing", pattern: /\b(test|tester|testing|qa|sdet)\b/i },
	{ family: "sales", pattern: /\b(sales|account executive|account manager|business development|bdr|sdr)\b/i },
	{ family: "management", pattern: /\b(manager|management|director|head|vp|chief)\b/i },
	{ family: "design", pattern: /\b(designer|design)\b/i },
	{ family: "recruiting", pattern: /\b(recruiter|recruiting|talent|sourcer)\b/i },
	{ family: "support", pattern: /\b(support|customer success|customer service|helpdesk)\b/i },
	{ family: "analytics", pattern: /\b(analyst|analytics)\b/i },
	{ family: "data science", pattern: /\b(scientist|research scientist)\b/i },
	{ family: "marketing", pattern: /\b(marketing|growth marketer|communications)\b/i },
	{ family: "legal or finance", pattern: /\b(counsel|legal|lawyer|paralegal|accountant|accounting|finance|tax)\b/i },
	{ family: "solutions", pattern: /\b(solutions|sales engineer|pre-?sales|forward deployed)\b/i },
	{ family: "writing", pattern: /\b(writer|editor)\b/i },
];

const TITLE_SUFFIX = /\s*(,|\(|\||:|\s[-–—]\s|\sat\s).*$/i;

const TITLE_STOPWORDS = new Set(["and", "or", "of", "the", "a", "an", "for", "to", "in", "at", "i", "ii", "iii", "-", "&", "/"]);

interface Part {
	points: number;
	reason?: string;
	caution?: string;
	capBelowGood?: boolean;
}

interface TargetTitle {
	title: string;
	tokens: Set<string>;
}

interface SkillMatcher {
	skill: string;
	pattern: RegExp;
}

export class MatchScorer {
	readonly #profile: Profile;
	readonly #targetTitles: TargetTitle[];
	readonly #targetVocabulary: Set<string>;
	readonly #targetText: string;
	readonly #skills: SkillMatcher[];
	readonly #excluded: string[];
	readonly #locations: string[];
	readonly #level: number;
	readonly #workCountries: Set<string>;

	constructor(profile: Profile) {
		this.#profile = profile;
		this.#targetTitles = profile.targetTitles
			.map((title) => ({ title, tokens: MatchScorer.titleTokens(title) }))
			.filter((target) => target.tokens.size > 0);
		this.#targetVocabulary = new Set(this.#targetTitles.flatMap((target) => [...target.tokens]));
		this.#targetText = profile.targetTitles.join(" | ");
		this.#skills = profile.skills.map((skill) => ({ skill, pattern: MatchScorer.skillPattern(skill) }));
		this.#excluded = profile.excludeKeywords.map((keyword) => keyword.toLowerCase()).filter(Boolean);
		this.#locations = profile.locations.map((location) => location.toLowerCase()).filter(Boolean);
		this.#level = SENIORITY_ORDER.indexOf(profile.seniority);
		this.#workCountries = new Set(profile.workCountries.map((country) => CountryResolver.country(country) ?? country));
	}

	static detectSeniority(title: string): Seniority {
		for (const [seniority, pattern] of SENIORITY_PATTERNS) {
			if (pattern.test(title)) {
				return seniority;
			}
		}
		return "mid";
	}

	static coreTitle(title: string): string {
		return title.replace(TITLE_SUFFIX, "").trim() || title;
	}

	score(posting: Posting): Score {
		const title = posting.title.toLowerCase();
		const exclusion = this.#excluded.find((keyword) => title.includes(keyword));
		if (exclusion) {
			return { score: 0, reasons: [], cautions: [`Title contains "${exclusion}", which you excluded`] };
		}

		const parts = [
			this.#scoreSkills(posting),
			this.#scoreTitle(posting),
			this.#scoreRoleFamily(posting),
			this.#scoreSeniority(posting),
			this.#scoreWorkMode(posting),
			this.#scoreWorkAuthorization(posting),
			this.#scoreLocation(posting),
		];
		const total = parts.reduce((sum, part) => sum + part.points, 0);
		const ceiling = parts.some((part) => part.capBelowGood) ? GOOD_FIT_SCORE - 1 : 100;
		return {
			score: Math.max(0, Math.min(ceiling, Math.round(total))),
			reasons: parts.flatMap((part) => (part.reason ? [part.reason] : [])),
			cautions: parts.flatMap((part) => (part.caution ? [part.caution] : [])),
		};
	}

	#scoreSkills(posting: Posting): Part {
		const searchable = `${posting.title}\n${posting.department ?? ""}\n${posting.text}`;
		const hits = this.#skills.filter(({ pattern }) => pattern.test(searchable)).map(({ skill }) => skill);
		const neededForFullCredit = Math.min(SKILLS_FOR_FULL_CREDIT, Math.max(1, this.#skills.length));
		const extra = hits.length > SKILLS_SHOWN ? ` +${hits.length - SKILLS_SHOWN}` : "";
		return {
			points: SKILL_POINTS * Math.min(1, hits.length / neededForFullCredit),
			reason: hits.length > 0 ? `Uses ${hits.slice(0, SKILLS_SHOWN).join(", ")}${extra}` : undefined,
		};
	}

	#scoreTitle(posting: Posting): Part {
		if (this.#targetTitles.length === 0) {
			return { points: TITLE_POINTS / 2 };
		}

		const postingTokens = MatchScorer.titleTokens(posting.title);
		let best = { overlap: 0, title: "" };
		for (const target of this.#targetTitles) {
			const overlap = [...target.tokens].filter((token) => postingTokens.has(token)).length / target.tokens.size;
			if (overlap > best.overlap) {
				best = { overlap, title: target.title };
			}
		}

		const coreTokens = [...MatchScorer.titleTokens(MatchScorer.coreTitle(posting.title))];
		const covered = coreTokens.filter((token) => this.#targetVocabulary.has(token)).length;
		const precision = coreTokens.length === 0 ? 1 : covered / coreTokens.length;
		const titleFit = best.overlap * (1 - TITLE_PRECISION_WEIGHT + TITLE_PRECISION_WEIGHT * precision);

		return {
			points: TITLE_POINTS * titleFit,
			reason: best.overlap >= 0.5 ? `Matches your target role "${best.title}"` : undefined,
		};
	}

	#scoreRoleFamily(posting: Posting): Part {
		const coreTitle = MatchScorer.coreTitle(posting.title);
		const shift = ROLE_SHIFTS.find(({ pattern }) => pattern.test(coreTitle) && !pattern.test(this.#targetText));
		return shift ? { points: -ROLE_SHIFT_PENALTY, caution: `Different kind of role (${shift.family})` } : { points: 0 };
	}

	#scoreSeniority(posting: Posting): Part {
		const postingSeniority = MatchScorer.detectSeniority(posting.title);
		const gap = Math.abs(SENIORITY_ORDER.indexOf(postingSeniority) - this.#level);
		if (gap === 0) {
			return { points: SENIORITY_POINTS };
		}
		if (gap === 1) {
			return { points: SENIORITY_POINTS / 3 };
		}
		return { points: -SENIORITY_MISMATCH_PENALTY, caution: `Looks ${SENIORITY_LABELS[postingSeniority]}` };
	}

	#scoreWorkMode(posting: Posting): Part {
		if (posting.workMode === "unknown" || this.#profile.workModes.includes(posting.workMode)) {
			return { points: 0 };
		}
		return { points: -WORK_MODE_PENALTY, caution: `${WORK_MODE_LABELS[posting.workMode]}, which you did not choose` };
	}

	#scoreLocation(posting: Posting): Part {
		const postingLocation = posting.location.toLowerCase();
		const inPreferredLocation = this.#locations.some((location) => postingLocation.includes(location));
		const anyLocation = this.#locations.length === 0;
		const where = posting.location || "an unlisted location";

		if (posting.workMode === "remote" && this.#profile.workModes.includes("remote")) {
			const region = MatchScorer.remoteRestriction(posting.location);
			if (region === null || inPreferredLocation || anyLocation) {
				return { points: LOCATION_POINTS, reason: "Remote" };
			}
			const countries = CountryResolver.countries(posting.location);
			if (countries.size > 0) {
				return this.#authorizedIn(countries) ? { points: LOCATION_POINTS, reason: `Remote in ${region}` } : { points: 0 };
			}
			return { points: -RESTRICTED_REMOTE_PENALTY, caution: `Remote, but only in ${region}` };
		}
		if (inPreferredLocation) {
			return { points: LOCATION_POINTS, reason: `In ${posting.location}` };
		}
		if (anyLocation) {
			return { points: LOCATION_POINTS / 2 };
		}
		if (this.#profile.openToRelocation) {
			return { points: -RELOCATION_PENALTY, caution: `Means relocating to ${where}` };
		}
		return { points: -LOCATION_MISMATCH_PENALTY, caution: `Based in ${where}` };
	}

	#scoreWorkAuthorization(posting: Posting): Part {
		const countries = CountryResolver.countries(posting.location);
		if (countries.size === 0 || this.#workCountries.size === 0 || this.#authorizedIn(countries)) {
			return { points: 0 };
		}
		const where = [...countries].join(" or ");
		if (NO_SPONSORSHIP.test(posting.text)) {
			return { points: -NO_SPONSORSHIP_PENALTY, caution: `Needs a work visa for ${where}, and the posting says it can't sponsor` };
		}
		if (OFFERS_SPONSORSHIP.test(posting.text)) {
			return { points: -SPONSORED_VISA_PENALTY, reason: "Offers visa sponsorship", caution: `Needs a work visa for ${where}` };
		}
		return { points: 0, caution: `Needs a work visa for ${where}, and sponsorship isn't mentioned`, capBelowGood: true };
	}

	#authorizedIn(countries: Set<string>): boolean {
		return [...countries].some((country) => this.#workCountries.has(country));
	}

	private static remoteRestriction(location: string): string | null {
		const region = location
			.replace(/\bremote\b/gi, "")
			.replace(/^[\s\-–,:;/|()]+|[\s\-–,:;/|()]+$/g, "")
			.trim();
		return region === "" || UNRESTRICTED_REMOTE.test(region) ? null : region;
	}

	private static titleTokens(title: string): Set<string> {
		return new Set(
			title
				.toLowerCase()
				.split(/[^a-z0-9+#.]+/)
				.filter((token) => token.length > 0 && !TITLE_STOPWORDS.has(token)),
		);
	}

	private static skillPattern(skill: string): RegExp {
		const trimmed = skill.trim();
		const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const caseSensitive = trimmed.length <= 2;
		return new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, caseSensitive ? "" : "i");
	}
}
