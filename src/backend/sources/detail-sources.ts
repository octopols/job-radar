import { XMLParser } from "fast-xml-parser";
import { z } from "zod";
import type { Ats } from "../../shared/types/board.ts";
import type { Posting } from "../../shared/types/posting.ts";
import { type BoardProbe, type BoardSnapshot, type FetchContext, JobSource } from "./job-source.ts";
import { PostingText } from "./posting-text.ts";

const MAX_POSTINGS = 200;
const PAGE_SIZE = 100;
const MAX_PAGES = 5;

type Summary = Omit<Posting, "text"> & { text: string | null };

class DescriptionLoader {
	static async attach(summaries: Summary[], context: FetchContext, describe: (id: string) => Promise<string>): Promise<Posting[]> {
		const newest = [...summaries].sort((a, b) => (b.postedAt ?? 0) - (a.postedAt ?? 0)).slice(0, MAX_POSTINGS);
		const cached = await context.storedTexts(newest.filter((summary) => summary.text === null).map((summary) => summary.id));
		return Promise.all(
			newest.map(async (summary) => {
				const text = summary.text ?? cached.get(summary.id) ?? (await describe(summary.id).catch(() => ""));
				return { ...summary, text };
			}),
		);
	}
}

const smartRecruitersListSchema = z.object({
	totalFound: z.number(),
	content: z.array(
		z.object({
			id: z.string(),
			name: z.string(),
			releasedDate: z.string().nullable().optional(),
			company: z.object({ name: z.string() }).optional(),
			department: z.object({ label: z.string().optional() }).optional(),
			location: z
				.object({
					city: z.string().nullable().optional(),
					region: z.string().nullable().optional(),
					country: z.string().nullable().optional(),
					fullLocation: z.string().nullable().optional(),
					remote: z.boolean().nullable().optional(),
					hybrid: z.boolean().nullable().optional(),
				})
				.optional(),
		}),
	),
});

const smartRecruitersDetailSchema = z.object({
	jobAd: z.object({ sections: z.record(z.string(), z.object({ text: z.string().optional() }).passthrough()) }).optional(),
});

export class SmartRecruitersSource extends JobSource {
	readonly ats: Ats = "smartrecruiters";

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const listed: z.infer<typeof smartRecruitersListSchema>["content"] = [];
		for (let page = 0; page < MAX_PAGES; page++) {
			const url = this.listingUrl(slug, context, `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`);
			const body = smartRecruitersListSchema.parse(await context.http.json(url));
			listed.push(...body.content);
			if (listed.length >= body.totalFound || body.content.length < PAGE_SIZE) {
				break;
			}
		}

		const summaries: Summary[] = listed.map((job) => {
			const location = (job.location?.fullLocation ?? PostingText.joinLocation([job.location?.city, job.location?.region, job.location?.country])).replace(/,\s*,/g, ",");
			const declared = job.location?.remote ? "remote" : job.location?.hybrid ? "hybrid" : null;
			return {
				id: job.id,
				title: job.name.trim(),
				location,
				...PostingText.workMode(declared, location),
				department: job.department?.label ?? null,
				url: `https://jobs.smartrecruiters.com/${slug}/${job.id}`,
				postedAt: PostingText.parseTime(job.releasedDate),
				text: null,
			};
		});

		const postings = await DescriptionLoader.attach(summaries, context, async (id) => {
			const detail = smartRecruitersDetailSchema.parse(await context.http.json(`https://api.smartrecruiters.com/v1/companies/${slug}/postings/${id}`));
			const sections = detail.jobAd?.sections ?? {};
			return PostingText.fromHtml(["jobDescription", "qualifications", "additionalInformation"].map((name) => sections[name]?.text ?? "").join("\n"));
		});
		return { companyName: listed[0]?.company?.name ?? null, postings };
	}

	async probe(slug: string, context: FetchContext): Promise<BoardProbe> {
		const url = this.listingUrl(slug, context, `https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=1`);
		const body = smartRecruitersListSchema.parse(await context.http.json(url));
		return { companyName: body.content[0]?.company?.name ?? null, openJobs: body.totalFound };
	}

	slugCandidates(company: string): string[] {
		const words = company.replace(/[^A-Za-z0-9\s]/g, "").split(/\s+/).filter(Boolean);
		const pascal = words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join("");
		return [...new Set([pascal, `${pascal}Group`, words.join("")])].filter(Boolean);
	}
}

const recruiteeSchema = z.object({
	offers: z.array(
		z.object({
			id: z.number(),
			title: z.string(),
			location: z.string().nullable().optional(),
			city: z.string().nullable().optional(),
			country: z.string().nullable().optional(),
			remote: z.boolean().nullable().optional(),
			hybrid: z.boolean().nullable().optional(),
			on_site: z.boolean().nullable().optional(),
			published_at: z.string().nullable().optional(),
			department: z.string().nullable().optional(),
			careers_url: z.string(),
			description: z.string().nullable().optional(),
			requirements: z.string().nullable().optional(),
			company_name: z.string().nullable().optional(),
		}),
	),
});

export class RecruiteeSource extends JobSource {
	readonly ats: Ats = "recruitee";

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const body = recruiteeSchema.parse(await context.http.json(this.listingUrl(slug, context, `https://${slug}.recruitee.com/api/offers/`)));
		return {
			companyName: body.offers[0]?.company_name ?? null,
			postings: body.offers.map((offer) => {
				const location = offer.location ?? PostingText.joinLocation([offer.city, offer.country]);
				const declared = offer.remote ? "remote" : offer.hybrid ? "hybrid" : offer.on_site ? "onsite" : null;
				return {
					id: String(offer.id),
					title: offer.title.trim(),
					location,
					...PostingText.workMode(declared, location),
					department: offer.department ?? null,
					url: offer.careers_url,
					postedAt: PostingText.parseTime(offer.published_at?.replace(" UTC", "Z").replace(" ", "T")),
					text: PostingText.fromHtml(`${offer.description ?? ""}\n${offer.requirements ?? ""}`),
				};
			}),
		};
	}
}

const workableListSchema = z.object({
	results: z.array(
		z.object({
			shortcode: z.string(),
			title: z.string(),
			published: z.string().nullable().optional(),
			workplace: z.string().nullable().optional(),
			remote: z.boolean().nullable().optional(),
			department: z.array(z.string()).nullable().optional(),
			location: z.object({ city: z.string().nullable().optional(), country: z.string().nullable().optional() }).nullable().optional(),
		}),
	),
	nextPage: z.string().nullable().optional(),
});

const workableDetailSchema = z.object({
	description: z.string().nullable().optional(),
	requirements: z.string().nullable().optional(),
});

export class WorkableSource extends JobSource {
	readonly ats: Ats = "workable";

	async probe(slug: string, context: FetchContext): Promise<BoardProbe> {
		const url = this.listingUrl(slug, context, `https://apply.workable.com/api/v3/accounts/${slug}/jobs`);
		const body = workableListSchema.parse(
			await context.http.json(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" }),
		);
		return { companyName: null, openJobs: body.results.length };
	}

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const listed: z.infer<typeof workableListSchema>["results"] = [];
		let token: string | null = null;
		for (let page = 0; page < MAX_PAGES; page++) {
			const url = this.listingUrl(slug, context, `https://apply.workable.com/api/v3/accounts/${slug}/jobs`);
			const body = workableListSchema.parse(
				await context.http.json(url, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(token ? { token } : {}),
				}),
			);
			listed.push(...body.results);
			token = body.nextPage ?? null;
			if (!token) {
				break;
			}
		}

		const summaries: Summary[] = listed.map((job) => {
			const location = PostingText.joinLocation([job.location?.city, job.location?.country]);
			return {
				id: job.shortcode,
				title: job.title.trim(),
				location,
				...PostingText.workMode(job.remote ? "remote" : (job.workplace ?? null), location),
				department: job.department?.[0] ?? null,
				url: `https://apply.workable.com/${slug}/j/${job.shortcode}/`,
				postedAt: PostingText.parseTime(job.published),
				text: null,
			};
		});

		const postings = await DescriptionLoader.attach(summaries, context, async (shortcode) => {
			const detail = workableDetailSchema.parse(await context.http.json(`https://apply.workable.com/api/v2/accounts/${slug}/jobs/${shortcode}`));
			return PostingText.fromHtml(`${detail.description ?? ""}\n${detail.requirements ?? ""}`);
		});
		return { companyName: null, postings };
	}
}

const personioPositionSchema = z.object({
	id: z.union([z.string(), z.number()]),
	name: z.string(),
	subcompany: z.string().optional(),
	office: z.string().optional(),
	additionalOffices: z.object({ office: z.union([z.string(), z.array(z.string())]) }).optional().or(z.literal("")),
	department: z.string().optional(),
	createdAt: z.string().optional(),
	jobDescriptions: z
		.object({ jobDescription: z.union([z.object({ value: z.string().optional() }), z.array(z.object({ value: z.string().optional() }))]) })
		.optional()
		.or(z.literal("")),
});

export class PersonioSource extends JobSource {
	readonly ats: Ats = "personio";
	readonly #parser = new XMLParser({ ignoreAttributes: true, isArray: (name) => name === "position" });

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const xml = await context.http.text(this.listingUrl(slug, context, `https://${slug}.jobs.personio.de/xml`));
		const document = this.#parser.parse(xml) as { "workzag-jobs"?: { position?: unknown[] } };
		const positions = (document["workzag-jobs"]?.position ?? []).map((position) => personioPositionSchema.parse(position));
		return {
			companyName: positions[0]?.subcompany ?? null,
			postings: positions.map((position) => {
				const extraOffices = position.additionalOffices ? [position.additionalOffices.office].flat() : [];
				const location = [position.office, ...extraOffices].filter(Boolean).join("; ");
				const descriptions = position.jobDescriptions ? [position.jobDescriptions.jobDescription].flat() : [];
				return {
					id: String(position.id),
					title: position.name.trim(),
					location,
					...PostingText.workMode(null, location),
					department: position.department ?? null,
					url: `https://${slug}.jobs.personio.de/job/${position.id}`,
					postedAt: PostingText.parseTime(position.createdAt),
					text: PostingText.fromHtml(descriptions.map((description) => description.value ?? "").join("\n")),
				};
			}),
		};
	}
}
