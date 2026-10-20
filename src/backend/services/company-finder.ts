import { BoardKey } from "../../shared/board-key.ts";
import { CATALOG } from "../../shared/catalog.ts";
import type { BoardRef, DiscoveredBoard, DiscoveryResult } from "../../shared/types/board.ts";
import { careerAssistant } from "../ai/career-assistant.ts";
import { jobBoards } from "../sources/job-board-client.ts";
import { BoardUrlParser } from "./board-url-parser.ts";

class CompanyFinder {
	async find(query: string): Promise<DiscoveryResult> {
		const company = query.trim();

		const linked = BoardUrlParser.find(company);
		if (linked) {
			const board = await this.#verify(linked, company);
			if (board) {
				return { status: "found", board, method: "link" };
			}
		}

		const known = CATALOG.find((entry) => entry.company.toLowerCase() === company.toLowerCase());
		if (known) {
			const board = await this.#verify(known, known.company);
			if (board) {
				return { status: "found", board, method: "lookup" };
			}
		}

		const guessed = await this.#probeCandidates(company);
		if (guessed) {
			return { status: "found", board: guessed, method: "lookup" };
		}

		return this.#askAi(company);
	}

	async #probeCandidates(company: string): Promise<DiscoveredBoard | null> {
		const attempts = jobBoards.sources.flatMap((source) => source.slugCandidates(company).map((slug) => ({ ats: source.ats, slug })));
		const results = await Promise.all(attempts.map((attempt) => this.#verify(attempt, company)));
		const found = results.filter((result): result is DiscoveredBoard => result !== null);
		return found.sort((a, b) => b.openJobs - a.openJobs)[0] ?? null;
	}

	async #askAi(company: string): Promise<DiscoveryResult> {
		const lead = await careerAssistant.findCareersPage(company);
		const pages = [lead.boardUrl, lead.careersUrl].filter((url): url is string => Boolean(url));

		for (const url of pages) {
			const fromUrl = BoardUrlParser.find(url);
			const fromPage = fromUrl ?? BoardUrlParser.find(await jobBoards.fetchPage(url).catch(() => ""));
			if (fromPage) {
				const board = await this.#verify(fromPage, company);
				if (board) {
					return { status: "found", board, method: "ai" };
				}
			}
		}

		const careersPage = lead.careersUrl ? await jobBoards.fetchPage(lead.careersUrl).catch(() => "") : "";
		const provider = BoardUrlParser.unsupportedProvider(`${pages.join(" ")} ${careersPage}`) ?? lead.provider;
		if (provider && lead.careersUrl) {
			return { status: "unsupported", company, provider, careersUrl: lead.careersUrl };
		}
		return { status: "not_found", company };
	}

	async #verify(board: BoardRef, fallbackName: string): Promise<DiscoveredBoard | null> {
		try {
			const { companyName, openJobs } = await jobBoards.probe(board);
			if (openJobs === 0) {
				return null;
			}
			return { key: BoardKey.of(board), ats: board.ats, slug: board.slug, company: companyName ?? fallbackName, openJobs };
		} catch {
			return null;
		}
	}
}

export const companyFinder = new CompanyFinder();
