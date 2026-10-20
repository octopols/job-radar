import type { SeekerMatch } from "@shared/types/match.ts";
import type { Posting } from "@shared/types/posting.ts";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SeekerConnection } from "@/lib/rivet.ts";

const PREVIEW_LENGTH = 900;

type PostingLoad = Posting | null | "loading";

export function PostingDescription({ match, connection }: { match: SeekerMatch; connection: SeekerConnection | null }) {
	const [posting, setPosting] = useState<PostingLoad>("loading");
	const [expanded, setExpanded] = useState(false);

	useEffect(() => {
		if (!connection) {
			return;
		}
		void connection
			.posting(match.boardKey, match.postingId)
			.then(setPosting)
			.catch(() => setPosting(null));
	}, [connection, match.boardKey, match.postingId]);

	const description = posting === "loading" ? "" : (posting?.text ?? "");
	const isLong = description.length > PREVIEW_LENGTH;

	return (
		<section className="flex flex-col gap-3">
			<h3 className="text-sm font-medium">About the role</h3>
			{posting === "loading" ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-11/12" />
					<Skeleton className="h-4 w-4/5" />
				</div>
			) : description === "" ? (
				<p className="text-sm text-muted-foreground">The full description is on the company's site.</p>
			) : (
				<>
					<p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
						{expanded ? description : description.slice(0, PREVIEW_LENGTH)}
						{!expanded && isLong && "..."}
					</p>
					{isLong && (
						<Button variant="link" size="sm" className="self-start px-0" onClick={() => setExpanded(!expanded)}>
							{expanded ? "Show less" : "Read the full description"}
						</Button>
					)}
				</>
			)}
		</section>
	);
}
