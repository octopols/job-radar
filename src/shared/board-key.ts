import { ATS_LIST, type Ats, type BoardRef } from "./types/board.ts";

export class BoardKey {
	static of(board: BoardRef): string {
		return `${board.ats}:${board.slug}`;
	}

	static parse(key: string): BoardRef {
		const [ats, slug] = key.split(":");
		if (!ATS_LIST.includes(ats as Ats) || !slug) {
			throw new Error(`Invalid board key ${key}. Expected ats:slug, for example greenhouse:stripe.`);
		}
		return { ats: ats as Ats, slug };
	}

	static ats(key: string): Ats {
		return BoardKey.parse(key).ats;
	}
}
