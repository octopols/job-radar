import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { Catalog, FEEDS } from "@shared/catalog.ts";
import type { CatalogBoard } from "@shared/types/board.ts";
import type { BoardStatus } from "@shared/types/board.ts";
import { CompanyFinderInput } from "@/features/companies/CompanyFinderInput.tsx";
import { TimeFormat } from "@/lib/format.ts";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

interface CompaniesSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	catalog: readonly CatalogBoard[];
	boards: Record<string, BoardStatus>;
	snapshot: SeekerSnapshot;
	connection: SeekerConnection | null;
	guard: Guard;
}

export function CompaniesSheet({ open, onOpenChange, catalog, boards, snapshot, connection, guard }: CompaniesSheetProps) {
	const follows = new Set(snapshot.follows);
	const syncing = new Set(snapshot.syncing);
	const catalogKeys = catalog.map((board) => `${board.ats}:${board.slug}`);
	const companies = [
		...catalog.map((board) => ({ key: `${board.ats}:${board.slug}`, name: board.company })),
		...snapshot.follows.filter((key) => !catalogKeys.includes(key) && !Catalog.feedKeys().includes(key)).map((key) => ({ key, name: boards[key]?.company ?? key })),
	].sort((a, b) => Number(follows.has(b.key)) - Number(follows.has(a.key)) || a.name.localeCompare(b.name));
	const unfollowed = catalogKeys.filter((key) => !follows.has(key));

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="flex flex-col gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md">
				<SheetHeader className="gap-4 border-b p-6">
					<div className="flex flex-col gap-1.5">
						<SheetTitle>Companies</SheetTitle>
						<SheetDescription>
							Watching {snapshot.follows.length} of {companies.length}. Each company's careers page is checked every 15 minutes by its own always-on agent.
						</SheetDescription>
					</div>
					<CompanyFinderInput
						connection={connection}
						guard={guard}
						follows={snapshot.follows}
						onWatch={async (board) => {
							await connection?.follow([board.key]);
						}}
					/>
				</SheetHeader>

				{unfollowed.length > 0 && (
					<div className="flex items-center justify-between border-b px-6 py-2 text-xs text-muted-foreground">
						{unfollowed.length} suggested {unfollowed.length === 1 ? "company" : "companies"} not watched
						<Button size="sm" variant="ghost" onClick={() => guard(async () => connection?.follow(unfollowed))}>
							Watch all
						</Button>
					</div>
				)}

				<ul className="flex-1 divide-y overflow-y-auto">
					<li className="bg-muted/40 px-6 py-2 text-xs font-medium text-muted-foreground">Job feeds</li>
					{FEEDS.map((feed) => {
						const key = `${feed.ats}:${feed.slug}`;
						const followed = follows.has(key);
						const status = boards[key];
						return (
							<li key={key} className="flex items-center gap-3 px-6 py-3">
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{feed.name}</p>
									<p className="truncate text-xs text-muted-foreground">
										{syncing.has(key)
											? "Scoring jobs..."
											: followed && status
												? `${status.openJobs.toLocaleString()} open roles${status.lastPolledAt ? ` · checked ${TimeFormat.relative(status.lastPolledAt)}` : ""}`
												: feed.description}
									</p>
								</div>
								{syncing.has(key) ? (
									<Spinner className="size-4 text-muted-foreground" />
								) : (
									<Switch
										checked={followed}
										aria-label={`Watch ${feed.name}`}
										onCheckedChange={(checked) => guard(async () => (checked ? connection?.follow([key]) : connection?.unfollow(key)))}
									/>
								)}
							</li>
						);
					})}
					<li className="bg-muted/40 px-6 py-2 text-xs font-medium text-muted-foreground">Companies</li>
					{companies.map(({ key, name }) => {
						const followed = follows.has(key);
						const status = boards[key];
						const error = snapshot.boardErrors[key];
						return (
							<li key={key} className="flex items-center gap-3 px-6 py-3">
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium">{name}</p>
									<p className="truncate text-xs text-muted-foreground">
										{error ? (
											<span className="text-destructive">Couldn't load this board</span>
										) : syncing.has(key) ? (
											"Scoring jobs..."
										) : followed && status ? (
											`${status.openJobs.toLocaleString()} open roles${status.lastPolledAt ? ` · checked ${TimeFormat.relative(status.lastPolledAt)}` : ""}`
										) : (
											"Not watching"
										)}
									</p>
								</div>
								{error && followed && (
									<Button variant="ghost" size="icon-sm" aria-label={`Retry ${name}`} onClick={() => guard(async () => connection?.retryBoards([key]))}>
										<RotateCw className="size-4" />
									</Button>
								)}
								{syncing.has(key) ? (
									<Spinner className="size-4 text-muted-foreground" />
								) : (
									<Switch
										checked={followed}
										aria-label={`Watch ${name}`}
										onCheckedChange={(checked) => guard(async () => (checked ? connection?.follow([key]) : connection?.unfollow(key)))}
									/>
								)}
							</li>
						);
					})}
				</ul>
			</SheetContent>
		</Sheet>
	);
}
