import { z } from "zod";
import type { Ats } from "../../shared/types/board.ts";
import { type BoardSnapshot, type FetchContext, JobSource } from "./job-source.ts";
import { PostingText } from "./posting-text.ts";

const greenhouseSchema = z.object({
	jobs: z.array(
		z.object({
			id: z.number(),
			title: z.string(),
			absolute_url: z.string(),
			company_name: z.string().nullable().optional(),
			location: z.object({ name: z.string().nullable() }).nullable(),
			first_published: z.string().nullable().optional(),
			updated_at: z.string().nullable().optional(),
			content: z.string().nullable().optional(),
			departments: z.array(z.object({ name: z.string() })).optional(),
		}),
	),
});

export class GreenhouseSource extends JobSource {
	readonly ats: Ats = "greenhouse";

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const url = this.listingUrl(slug, context, `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`);
		const body = greenhouseSchema.parse(await context.http.json(url));
		return {
			companyName: body.jobs[0]?.company_name ?? null,
			postings: body.jobs.map((job) => {
				const location = job.location?.name ?? "";
				return {
					id: String(job.id),
					title: job.title.trim(),
					location,
					...PostingText.workMode(null, location),
					department: job.departments?.[0]?.name ?? null,
					url: job.absolute_url,
					postedAt: PostingText.parseTime(job.first_published ?? job.updated_at),
					text: PostingText.fromHtml(job.content ?? ""),
				};
			}),
		};
	}
}

const leverSchema = z.array(
	z.object({
		id: z.string(),
		text: z.string(),
		hostedUrl: z.string(),
		createdAt: z.number().nullable().optional(),
		workplaceType: z.string().nullable().optional(),
		descriptionPlain: z.string().nullable().optional(),
		additionalPlain: z.string().nullable().optional(),
		categories: z.object({ location: z.string().nullable().optional(), team: z.string().nullable().optional() }).optional(),
	}),
);

export class LeverSource extends JobSource {
	readonly ats: Ats = "lever";

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const url = this.listingUrl(slug, context, `https://api.lever.co/v0/postings/${slug}?mode=json`);
		const body = leverSchema.parse(await context.http.json(url));
		return {
			companyName: null,
			postings: body.map((job) => {
				const location = job.categories?.location ?? "";
				return {
					id: job.id,
					title: job.text.trim(),
					location,
					...PostingText.workMode(job.workplaceType ?? null, location),
					department: job.categories?.team ?? null,
					url: job.hostedUrl,
					postedAt: job.createdAt ?? null,
					text: PostingText.truncate([job.descriptionPlain, job.additionalPlain].filter(Boolean).join("\n")),
				};
			}),
		};
	}
}

const ashbySchema = z.object({
	jobs: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			jobUrl: z.string(),
			location: z.string().nullable().optional(),
			department: z.string().nullable().optional(),
			isRemote: z.boolean().nullable().optional(),
			workplaceType: z.string().nullable().optional(),
			publishedAt: z.string().nullable().optional(),
			isListed: z.boolean().nullable().optional(),
			descriptionPlain: z.string().nullable().optional(),
		}),
	),
});

export class AshbySource extends JobSource {
	readonly ats: Ats = "ashby";

	async fetch(slug: string, context: FetchContext): Promise<BoardSnapshot> {
		const url = this.listingUrl(slug, context, `https://api.ashbyhq.com/posting-api/job-board/${slug}`);
		const body = ashbySchema.parse(await context.http.json(url));
		return {
			companyName: null,
			postings: body.jobs
				.filter((job) => job.isListed !== false)
				.map((job) => {
					const location = job.location ?? "";
					return {
						id: job.id,
						title: job.title.trim(),
						location,
						...PostingText.workMode(job.isRemote === true ? "remote" : (job.workplaceType ?? null), location),
						department: job.department ?? null,
						url: job.jobUrl,
						postedAt: PostingText.parseTime(job.publishedAt),
						text: PostingText.truncate(job.descriptionPlain ?? ""),
					};
				}),
		};
	}
}
