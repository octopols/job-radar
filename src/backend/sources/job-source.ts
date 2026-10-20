import type { Ats } from "../../shared/types/board.ts";
import type { Posting } from "../../shared/types/posting.ts";
import type { HttpFetcher } from "./http-fetcher.ts";

export interface BoardSnapshot {
	companyName: string | null;
	postings: Posting[];
}

export interface BoardProbe {
	companyName: string | null;
	openJobs: number;
}

export type StoredTexts = (postingIds: string[]) => Promise<Map<string, string>>;

export interface FetchContext {
	http: HttpFetcher;
	storedTexts: StoredTexts;
	mirrorBaseUrl: string | null;
}

export abstract class JobSource {
	abstract readonly ats: Ats;
	readonly minPollIntervalMs: number = 0;

	abstract fetch(slug: string, context: FetchContext): Promise<BoardSnapshot>;

	async probe(slug: string, context: FetchContext): Promise<BoardProbe> {
		const snapshot = await this.fetch(slug, context);
		return { companyName: snapshot.companyName, openJobs: snapshot.postings.length };
	}

	slugCandidates(company: string): string[] {
		const words = company.toLowerCase().replace(/[^a-z0-9\s-]/g, "").split(/[\s-]+/).filter(Boolean);
		return [...new Set([words.join(""), words.join("-"), words.join("_")])].filter(Boolean);
	}

	protected listingUrl(slug: string, context: FetchContext, publicUrl: string): string {
		return context.mirrorBaseUrl ? `${context.mirrorBaseUrl}/${this.ats}/${slug}` : publicUrl;
	}
}
