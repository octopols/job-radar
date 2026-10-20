const COUNTRY_ALIASES: Record<string, string[]> = {
	"United States": [
		"united states", "united states of america", "usa", "u.s.", "u.s.a.", "us", "america",
		"san francisco", "new york", "nyc", "seattle", "austin", "boston", "chicago", "los angeles", "denver", "atlanta",
		"menlo park", "palo alto", "mountain view", "sunnyvale", "san jose", "san mateo", "redwood city", "bellevue", "kirkland",
		"washington dc", "washington, dc", "miami", "portland", "san diego", "pittsburgh", "philadelphia", "salt lake city", "raleigh",
	],
	India: ["india", "bengaluru", "bangalore", "mumbai", "pune", "hyderabad", "chennai", "delhi", "new delhi", "gurgaon", "gurugram", "noida", "kolkata", "ahmedabad"],
	Canada: ["canada", "toronto", "vancouver", "montreal", "ottawa", "waterloo", "calgary"],
	"United Kingdom": ["united kingdom", "uk", "u.k.", "england", "scotland", "london", "manchester", "edinburgh", "cambridge, uk"],
	Ireland: ["ireland", "dublin"],
	Germany: ["germany", "berlin", "munich", "hamburg", "frankfurt"],
	France: ["france", "paris"],
	Netherlands: ["netherlands", "amsterdam"],
	Spain: ["spain", "madrid", "barcelona"],
	Portugal: ["portugal", "lisbon"],
	Poland: ["poland", "warsaw", "krakow"],
	Sweden: ["sweden", "stockholm"],
	Switzerland: ["switzerland", "zurich", "geneva"],
	Singapore: ["singapore"],
	Japan: ["japan", "tokyo"],
	"South Korea": ["south korea", "korea", "seoul"],
	China: ["china", "shanghai", "beijing", "shenzhen"],
	Australia: ["australia", "sydney", "melbourne"],
	"New Zealand": ["new zealand", "auckland"],
	Brazil: ["brazil", "sao paulo", "são paulo"],
	Mexico: ["mexico", "mexico city"],
	Israel: ["israel", "tel aviv"],
	"United Arab Emirates": ["united arab emirates", "uae", "dubai", "abu dhabi"],
};

const US_STATE_CODES = new Set(
	"AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC".split(" "),
);
const CANADIAN_PROVINCE_CODES = new Set("AB BC MB NB NL NS ON PE QC SK".split(" "));

export class CountryResolver {
	static readonly #aliases: { country: string; pattern: RegExp }[] = Object.entries(COUNTRY_ALIASES)
		.flatMap(([country, aliases]) => aliases.map((alias) => ({ country, alias })))
		.sort((a, b) => b.alias.length - a.alias.length)
		.map(({ country, alias }) => ({ country, pattern: CountryResolver.aliasPattern(alias) }));

	static countries(location: string): Set<string> {
		const found = new Set<string>();
		for (const segment of location.split(/[;|/]| or /i)) {
			const parts = segment.split(",").map((part) => part.trim());
			const last = parts.at(-1) ?? "";
			if (parts.length > 1 && US_STATE_CODES.has(last)) {
				found.add("United States");
				continue;
			}
			if (parts.length > 1 && CANADIAN_PROVINCE_CODES.has(last)) {
				found.add("Canada");
				continue;
			}
			const match = CountryResolver.#aliases.find(({ pattern }) => pattern.test(segment));
			if (match) {
				found.add(match.country);
			}
		}
		return found;
	}

	static country(text: string): string | null {
		return [...CountryResolver.countries(text)][0] ?? null;
	}

	static fromLocations(locations: readonly string[]): string[] {
		return [...new Set(locations.flatMap((location) => [...CountryResolver.countries(location)]))];
	}

	private static aliasPattern(alias: string): RegExp {
		const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

		const caseSensitive = alias.length <= 3 && !alias.includes(".");
		return new RegExp(`(?<![A-Za-z])${caseSensitive ? escaped.toUpperCase() : escaped}(?![A-Za-z])`, caseSensitive ? "" : "i");
	}
}
