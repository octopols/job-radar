import type { SeekerMatch } from "@shared/types/match.ts";
import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

interface FitBriefProps {
	match: SeekerMatch;
	connection: SeekerConnection | null;
	guard: Guard;
}

export function FitBrief({ match, connection, guard }: FitBriefProps) {
	const [brief, setBrief] = useState(match.explanation);
	const [writing, setWriting] = useState(false);

	const requestBrief = () =>
		guard(async () => {
			setWriting(true);
			try {
				setBrief((await connection?.explainFit(match.boardKey, match.postingId)) ?? null);
			} finally {
				setWriting(false);
			}
		});

	return (
		<section className="flex flex-col gap-3">
			{brief ? (
				<div className="rounded-lg border bg-muted/40 p-4 text-sm leading-relaxed whitespace-pre-wrap">
					<p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
						<Sparkles className="size-3.5" /> Fit brief
					</p>
					{brief}
				</div>
			) : (
				<Button variant="outline" className="self-start" disabled={writing || !connection} onClick={requestBrief}>
					{writing ? <Spinner className="size-4" /> : <Sparkles className="size-4" />}
					{writing ? "Reading the posting..." : "Get a fit brief"}
				</Button>
			)}
		</section>
	);
}
