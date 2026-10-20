import { Check, ExternalLink, Search } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { DiscoveredBoard, DiscoveryResult } from "@shared/types/board.ts";
import { PROVIDER_LABELS } from "@shared/catalog.ts";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";



interface CompanyFinderInputProps {
	connection: SeekerConnection | null;
	guard: Guard;
	follows: string[];
	onWatch: (board: DiscoveredBoard) => Promise<void>;
}

export function CompanyFinderInput({ connection, guard, follows, onWatch }: CompanyFinderInputProps) {
	const [query, setQuery] = useState("");
	const [searching, setSearching] = useState(false);
	const [result, setResult] = useState<DiscoveryResult | null>(null);

	const search = (event: FormEvent) => {
		event.preventDefault();
		if (!connection || query.trim().length < 2) {
			return;
		}
		void guard(async () => {
			setSearching(true);
			setResult(null);
			try {
				setResult(await connection.findCompany(query.trim()));
			} finally {
				setSearching(false);
			}
		});
	};

	return (
		<div className="flex flex-col gap-2">
			<form onSubmit={search} className="flex gap-2">
				<div className="relative flex-1">
					<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="pl-8"
						placeholder="Any company name or careers link"
						aria-label="Company to add"
						value={query}
						onChange={(event) => {
							setQuery(event.target.value);
							setResult(null);
						}}
					/>
				</div>
				<Button type="submit" variant="secondary" disabled={searching || !connection || query.trim().length < 2}>
					{searching ? <Spinner className="size-4" /> : "Find"}
				</Button>
			</form>

			{searching && <p className="text-xs text-muted-foreground">Checking job boards. If it's not on a common one, AI looks up their careers page, which can take up to a minute.</p>}

			{result?.status === "found" && (
				<div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm font-medium">{result.board.company}</p>
						<p className="text-xs text-muted-foreground">
							{PROVIDER_LABELS[result.board.ats]} · {result.board.openJobs.toLocaleString()} open {result.board.openJobs === 1 ? "role" : "roles"}
						</p>
					</div>
					{follows.includes(result.board.key) ? (
						<span className="flex items-center gap-1 text-xs font-medium text-success">
							<Check className="size-3.5" /> Watching
						</span>
					) : (
						<Button
							size="sm"
							onClick={() =>
								guard(async () => {
									await onWatch(result.board);
									setQuery("");
								})
							}
						>
							Watch
						</Button>
					)}
				</div>
			)}

			{result?.status === "unsupported" && (
				<p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
					{result.company} lists jobs on {result.provider}, which we can't read yet.{" "}
					{result.careersUrl && (
						<a href={result.careersUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-foreground underline-offset-4 hover:underline">
							Open their careers page <ExternalLink className="size-3" />
						</a>
					)}
				</p>
			)}

			{result?.status === "not_found" && (
				<p className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
					We couldn't find a public job board for {result.company}. Try pasting a link to one of their job postings.
				</p>
			)}
		</div>
	);
}
