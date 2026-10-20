import { MatchRanker } from "@shared/ranking.ts";
import type { SeekerMatch } from "@shared/types/match.ts";
import type { Profile } from "@shared/types/profile.ts";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { ArrowUp, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeedEmptyState } from "@/features/feed/FeedEmptyState.tsx";
import { FeedFiltersPopover } from "@/features/feed/FeedFiltersPopover.tsx";
import { DEFAULT_FILTERS, type FeedFilters, type FeedSort, type FeedTab, FeedView } from "@/features/feed/feed-view.ts";
import { JobDetailSheet } from "@/features/feed/JobDetailSheet.tsx";
import { JobRow } from "@/features/feed/JobRow.tsx";
import { FIT_LEVELS } from "@/lib/format.ts";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

interface FeedProps {
	matches: SeekerMatch[];
	snapshot: SeekerSnapshot & { profile: Profile };
	onMatchChanged: (match: SeekerMatch) => void;
	connection: SeekerConnection | null;
	guard: Guard;
	openedAt: number;
	onEditPreferences: () => void;
}

const PAGE_SIZE = 30;
const LOADING_ROWS = 6;
const TAB_LABELS: Record<FeedTab, string> = { new: "For you", saved: "Saved", applications: "Applications" };

export function Feed({ matches, snapshot, onMatchChanged, connection, guard, openedAt, onEditPreferences }: FeedProps) {
	const [tab, setTab] = useState<FeedTab>("new");
	const [sort, setSort] = useState<FeedSort>("recommended");
	const [filters, setFilters] = useState<FeedFilters>(DEFAULT_FILTERS);
	const [search, setSearch] = useState("");
	const [searchOpen, setSearchOpen] = useState(false);
	const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
	const [revealedAt, setRevealedAt] = useState(openedAt);
	const [selectedKey, setSelectedKey] = useState<string | null>(null);
	const ranker = useMemo(() => new MatchRanker(Date.now()), [matches]);

	const arrivedSinceReveal = (match: SeekerMatch) => match.live && match.foundAt > revealedAt;
	const unrevealed = matches.filter((match) => match.status === "new" && arrivedSinceReveal(match));
	const lists = useMemo(() => FeedView.lists(matches, filters, search, arrivedSinceReveal), [matches, filters, search, revealedAt]);
	const ordered = useMemo(() => FeedView.ordered(lists, tab, sort, ranker), [lists, tab, sort, ranker]);

	const selected = matches.find((match) => FeedView.matchKey(match) === selectedKey) ?? null;
	const strongCount = lists.new.filter((match) => match.score >= FIT_LEVELS.strong.minScore).length;
	const postedThisWeek = FeedView.postedThisWeek(lists.new);
	const followUpsDue = lists.applications.filter((match) => match.followUpDue && match.status === "applied").length;
	const activeFilterCount = FeedView.activeFilterCount(filters);
	const updating = snapshot.syncing.length > 0;
	const firstSync = updating && lists.new.length === 0;

	const toggleSave = (match: SeekerMatch) =>
		guard(async () => {
			const changed = await connection?.setStatus(match.boardKey, match.postingId, match.status === "saved" ? "new" : "saved");
			if (changed) {
				onMatchChanged(changed);
			}
		});

	const closeSearch = () => {
		setSearch("");
		setSearchOpen(false);
	};

	const resetFilters = () => {
		setFilters(DEFAULT_FILTERS);
		setSearch("");
	};

	const heading = firstSync
		? "Updating your matches..."
		: strongCount > 0
			? `${strongCount} strong ${strongCount === 1 ? "match" : "matches"} for you`
			: `${lists.new.length} matches for you`;

	return (
		<section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
			<header className="flex flex-col gap-1">
				<h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
				<p className="text-sm text-muted-foreground">
					{updating && !firstSync && <span className="text-foreground">Updating from {snapshot.syncing.length} companies · </span>}
					{FeedView.searchSummary(snapshot.profile)} · {FeedView.sourcesSummary(snapshot.follows)}
					{postedThisWeek > 0 && <> · {postedThisWeek} posted this week</>} ·{" "}
					<button type="button" className="font-medium text-foreground underline-offset-4 hover:underline" onClick={onEditPreferences}>
						Edit
					</button>
				</p>
			</header>

			<div className="flex flex-wrap items-center gap-2">
				<Tabs value={tab} onValueChange={(value) => setTab(value as FeedTab)} className="mr-auto">
					<TabsList>
						{(Object.keys(TAB_LABELS) as FeedTab[]).map((name) => (
							<TabsTrigger key={name} value={name} className="gap-1.5">
								{TAB_LABELS[name]}
								{name !== "new" && lists[name].length > 0 && <span className="text-xs tabular-nums text-muted-foreground">{lists[name].length}</span>}
								{name === "applications" && followUpsDue > 0 && <span className="size-1.5 rounded-full bg-warning" aria-label="Follow-ups due" />}
							</TabsTrigger>
						))}
					</TabsList>
				</Tabs>

				{searchOpen ? (
					<div className="relative w-full sm:w-56">
						<Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input autoFocus className="h-8 pr-8 pl-8" placeholder="Title, company, place" value={search} onChange={(event) => setSearch(event.target.value)} />
						<button type="button" aria-label="Close search" className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground" onClick={closeSearch}>
							<X className="size-4" />
						</button>
					</div>
				) : (
					<Button variant="ghost" size="icon-sm" aria-label="Search" onClick={() => setSearchOpen(true)}>
						<Search className="size-4" />
					</Button>
				)}

				{tab === "new" && <FeedFiltersPopover filters={filters} onChange={setFilters} activeCount={activeFilterCount} />}
				{tab !== "applications" && (
					<Select value={sort} onValueChange={(value) => setSort(value as FeedSort)}>
						<SelectTrigger size="sm" className="w-36" aria-label="Sort">
							<SelectValue />
						</SelectTrigger>
						<SelectContent align="end">
							<SelectItem value="recommended">Recommended</SelectItem>
							<SelectItem value="fit">Best fit</SelectItem>
							<SelectItem value="posted">Newest</SelectItem>
						</SelectContent>
					</Select>
				)}
			</div>

			{tab === "new" && unrevealed.length > 0 && (
				<Button variant="secondary" className="self-center rounded-full shadow-sm" onClick={() => setRevealedAt(Date.now())}>
					<ArrowUp className="size-4" />
					{unrevealed.length} new {unrevealed.length === 1 ? "match" : "matches"}
				</Button>
			)}

			{firstSync ? (
				<div className="flex flex-col gap-px overflow-hidden rounded-xl border">
					{Array.from({ length: LOADING_ROWS }, (_, index) => (
						<Skeleton key={index} className="h-[76px] rounded-none" />
					))}
				</div>
			) : ordered.length === 0 ? (
				<FeedEmptyState tab={tab} filtered={activeFilterCount > 0 || search !== ""} onResetFilters={resetFilters} />
			) : (
				<>
					<ul className="divide-y overflow-hidden rounded-xl border bg-card">
						{ordered.slice(0, visibleCount).map((match) => (
							<JobRow
								key={FeedView.matchKey(match)}
								match={match}
								recentlyPosted={ranker.isFresh(match)}
								selected={FeedView.matchKey(match) === selectedKey}
								onOpen={() => setSelectedKey(FeedView.matchKey(match))}
								onToggleSave={() => toggleSave(match)}
							/>
						))}
					</ul>
					{ordered.length > visibleCount && (
						<Button variant="ghost" className="self-center text-muted-foreground" onClick={() => setVisibleCount(visibleCount + PAGE_SIZE)}>
							Show more
						</Button>
					)}
				</>
			)}

			<JobDetailSheet match={selected} snapshot={snapshot} onClose={() => setSelectedKey(null)} connection={connection} guard={guard} onMatchChanged={onMatchChanged} />
		</section>
	);
}
