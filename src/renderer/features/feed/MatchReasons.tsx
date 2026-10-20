import type { SeekerMatch } from "@shared/types/match.ts";
import { AlertTriangle, Check } from "lucide-react";

export function MatchReasons({ match }: { match: SeekerMatch }) {
	if (match.reasons.length === 0 && match.cautions.length === 0) {
		return null;
	}
	return (
		<section className="flex flex-col gap-3">
			<h3 className="text-sm font-medium">Why it's on your list</h3>
			<ul className="flex flex-col gap-2 text-sm">
				{match.reasons.map((reason) => (
					<li key={reason} className="flex gap-2">
						<Check className="mt-0.5 size-4 shrink-0 text-success" />
						{reason}
					</li>
				))}
				{match.cautions.map((caution) => (
					<li key={caution} className="flex gap-2 text-warning">
						<AlertTriangle className="mt-0.5 size-4 shrink-0" />
						{caution}
					</li>
				))}
			</ul>
		</section>
	);
}
