import { z } from "zod";
import type { Ats } from "../../shared/types/board.ts";
import type { Posting } from "../../shared/types/posting.ts";
import { CountryResolver } from "../../shared/geo.ts";
import { type BoardSnapshot, type FetchContext, JobSource } from "./job-source.ts";
import { PostingText } from "./posting-text.ts";

const HOUR_MS = 3_600_000;

abstract class FeedSource extends JobSource {
	slugCandidates(): string[] {
		return [];
	}
}

const remoteOkSchema = z.array(
	z
		.object({
			id: z.union([z.string(), z.number()]).optional(),
			epoch: z.number().optional(),
			position: z.string().optional(),
			company: z.string().optional(),
			location: z.string().nullable().optional(),
			tags: z.array(z.string()).optional(),
			url: z.string().optional(),
			description: z.string().nullable().optional(),
		})
		.passthrough(),
);

export class RemoteOkSource extends FeedSource {
	readonly ats: Ats = "remoteok";
	readonly minPollIntervalMs = 2 * HOUR_MS;

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const items = remoteOkSchema.parse(await context.http.json(this.listingUrl(slug, context, "https://remoteok.com/api")));
		const postings: Posting[] = items
			.filter((item) => item.id !== undefined && item.position && item.company && item.url)
			.map((item) => {
				const location = RemoteOkSource.repairEncoding(item.location?.trim() || "Remote");
				return {
					id: String(item.id),
					title: RemoteOkSource.repairEncoding(item.position ?? "").trim(),
					company: RemoteOkSource.repairEncoding(item.company ?? "").trim(),
					location: /remote/i.test(location) ? location : `Remote, ${location}`,
					workMode: "remote",
					remote: true,
					department: null,
					url: item.url ?? "",
					postedAt: item.epoch ? item.epoch * 1000 : null,
					text: PostingText.fromHtml(`${RemoteOkSource.repairEncoding(item.description ?? "")}\n${(item.tags ?? []).join(", ")}`),
				};
			});
		return { companyName: "Remote OK", postings };
	}

	private static repairEncoding(text: string): string {
		return /[âÃ]/.test(text) ? Buffer.from(text, "latin1").toString("utf8") : text;
	}
}

const hnSearchSchema = z.object({ hits: z.array(z.object({ objectID: z.string(), title: z.string() })) });
const hnItemSchema = z.object({
	children: z.array(z.object({ id: z.number(), created_at: z.string().nullable().optional(), text: z.string().nullable().optional() })),
});

const ROLE_WORDS = /\b(engineer|developer|designer|scientist|manager|architect|analyst|devops|sre|researcher|founding|cto|head of|lead|product|marketing|sales|recruiter|roles?)\b/i;
const WORK_MODE_WORDS = /\b(remote|onsite|on-site|hybrid|in[- ]office)\b/i;

export class HackerNewsSource extends FeedSource {
	readonly ats: Ats = "hackernews";
	readonly minPollIntervalMs = 6 * HOUR_MS;

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const search = hnSearchSchema.parse(
			await context.http.json(this.listingUrl(slug, context, "https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&hitsPerPage=5")),
		);
		const thread = search.hits.find((hit) => /who is hiring/i.test(hit.title));
		if (!thread) {
			return { companyName: "Hacker News", postings: [] };
		}
		const item = hnItemSchema.parse(await context.http.json(`https://hn.algolia.com/api/v1/items/${thread.objectID}`));
		const postings = item.children.flatMap((comment) => {
			const posting = HackerNewsSource.parse(comment.id, comment.text ?? "", comment.created_at ?? null);
			return posting ? [posting] : [];
		});
		return { companyName: "Hacker News", postings };
	}

	static parse(id: number, html: string, createdAt: string | null): Posting | null {
		const firstLine = PostingText.fromHtml(html.split(/<p>/i)[0] ?? "").split("\n")[0] ?? "";
		const segments = firstLine
			.split(/\s+\|\s+|\s+[—–]\s+/)
			.map((segment) => segment.replace(/https?:\/\/\S+/g, "").trim())
			.filter(Boolean);
		const first = segments[0];
		if (!first || segments.length < 2) {
			return null;
		}

		const bracketed = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(first);
		const bracketIsPlace = bracketed?.[2] !== undefined && HackerNewsSource.isPlace(bracketed[2]);
		const company = bracketIsPlace && bracketed?.[1] ? bracketed[1] : first;
		const rest = segments.slice(1);
		const role = rest.find((segment) => ROLE_WORDS.test(segment)) ?? "Multiple roles";
		const candidates = [...rest.filter((segment) => segment !== role), ...(bracketIsPlace && bracketed?.[2] ? [bracketed[2]] : [])];
		const location =
			candidates.find((segment) => CountryResolver.countries(segment).size > 0) ?? candidates.find((segment) => WORK_MODE_WORDS.test(segment)) ?? "";
		const declared = WORK_MODE_WORDS.exec(firstLine)?.[1] ?? null;
		return {
			id: String(id),
			title: role.length > 120 ? `${role.slice(0, 117)}...` : role,
			company: company.length > 60 ? company.slice(0, 60) : company,
			location,
			...PostingText.workMode(declared?.replace(/[- ]/g, "") ?? null, location),
			department: null,
			url: `https://news.ycombinator.com/item?id=${id}`,
			postedAt: PostingText.parseTime(createdAt),
			text: PostingText.fromHtml(html),
		};
	}

	private static isPlace(text: string): boolean {
		return CountryResolver.countries(text).size > 0 || WORK_MODE_WORDS.test(text);
	}
}
