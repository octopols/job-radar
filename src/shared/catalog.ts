import type { Ats, CatalogBoard, CatalogFeed } from "./types/board.ts";

export const CATALOG: readonly CatalogBoard[] = [
	{ ats: "greenhouse", slug: "stripe", company: "Stripe" },
	{ ats: "greenhouse", slug: "airbnb", company: "Airbnb" },
	{ ats: "greenhouse", slug: "discord", company: "Discord" },
	{ ats: "greenhouse", slug: "figma", company: "Figma" },
	{ ats: "greenhouse", slug: "dropbox", company: "Dropbox" },
	{ ats: "greenhouse", slug: "robinhood", company: "Robinhood" },
	{ ats: "greenhouse", slug: "coinbase", company: "Coinbase" },
	{ ats: "greenhouse", slug: "cloudflare", company: "Cloudflare" },
	{ ats: "greenhouse", slug: "datadog", company: "Datadog" },
	{ ats: "greenhouse", slug: "gitlab", company: "GitLab" },
	{ ats: "greenhouse", slug: "reddit", company: "Reddit" },
	{ ats: "greenhouse", slug: "pinterest", company: "Pinterest" },
	{ ats: "greenhouse", slug: "lyft", company: "Lyft" },
	{ ats: "greenhouse", slug: "instacart", company: "Instacart" },
	{ ats: "greenhouse", slug: "twitch", company: "Twitch" },
	{ ats: "greenhouse", slug: "mongodb", company: "MongoDB" },
	{ ats: "greenhouse", slug: "elastic", company: "Elastic" },
	{ ats: "greenhouse", slug: "databricks", company: "Databricks" },
	{ ats: "greenhouse", slug: "anthropic", company: "Anthropic" },
	{ ats: "greenhouse", slug: "vercel", company: "Vercel" },
	{ ats: "greenhouse", slug: "samsara", company: "Samsara" },
	{ ats: "greenhouse", slug: "affirm", company: "Affirm" },
	{ ats: "greenhouse", slug: "asana", company: "Asana" },
	{ ats: "greenhouse", slug: "brex", company: "Brex" },
	{ ats: "greenhouse", slug: "duolingo", company: "Duolingo" },
	{ ats: "greenhouse", slug: "scaleai", company: "Scale AI" },
	{ ats: "greenhouse", slug: "okta", company: "Okta" },
	{ ats: "lever", slug: "palantir", company: "Palantir" },
	{ ats: "lever", slug: "spotify", company: "Spotify" },
	{ ats: "lever", slug: "zoox", company: "Zoox" },
	{ ats: "ashby", slug: "notion", company: "Notion" },
	{ ats: "ashby", slug: "openai", company: "OpenAI" },
	{ ats: "ashby", slug: "ramp", company: "Ramp" },
	{ ats: "ashby", slug: "linear", company: "Linear" },
	{ ats: "ashby", slug: "supabase", company: "Supabase" },
	{ ats: "ashby", slug: "posthog", company: "PostHog" },
	{ ats: "ashby", slug: "replit", company: "Replit" },
	{ ats: "ashby", slug: "vanta", company: "Vanta" },
	{ ats: "ashby", slug: "cohere", company: "Cohere" },
	{ ats: "ashby", slug: "elevenlabs", company: "ElevenLabs" },
	{ ats: "ashby", slug: "perplexity", company: "Perplexity" },
];

export const PROVIDER_LABELS: Record<Ats, string> = {
	greenhouse: "Greenhouse",
	lever: "Lever",
	ashby: "Ashby",
	smartrecruiters: "SmartRecruiters",
	recruitee: "Recruitee",
	workable: "Workable",
	personio: "Personio",
	remoteok: "Remote OK",
	hackernews: "Hacker News",
};

export const FEEDS: readonly CatalogFeed[] = [
	{ ats: "hackernews", slug: "whoishiring", name: "Hacker News: Who's Hiring", description: "Startups posting on this month's Hacker News thread" },
	{ ats: "remoteok", slug: "all", name: "Remote OK", description: "Remote roles from Remote OK" },
];

export class Catalog {
	static isFeed(ats: Ats): boolean {
		return FEEDS.some((feed) => feed.ats === ats);
	}

	static isKnownCompany(ats: Ats, slug: string): boolean {
		return CATALOG.some((board) => board.ats === ats && board.slug === slug) || Catalog.isFeed(ats);
	}

	static companyName(ats: Ats, slug: string): string {
		const feed = FEEDS.find((entry) => entry.ats === ats);
		if (feed) {
			return feed.name;
		}
		return CATALOG.find((board) => board.ats === ats && board.slug === slug)?.company ?? slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
	}

	static feedKeys(): string[] {
		return FEEDS.map((feed) => `${feed.ats}:${feed.slug}`);
	}
}
