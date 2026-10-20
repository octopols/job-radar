import { Briefcase, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import type { FeedTab } from "@/features/feed/feed-view.ts";

interface FeedEmptyStateProps {
	tab: FeedTab;
	filtered: boolean;
	onResetFilters: () => void;
}

export function FeedEmptyState({ tab, filtered, onResetFilters }: FeedEmptyStateProps) {
	const copy: Record<FeedTab, { title: string; description: string }> = {
		new: filtered
			? { title: "No matches with these filters", description: "Loosen a filter to see more. New postings arrive here on their own." }
			: { title: "No matches yet", description: "We're watching your companies. New postings that fit you will show up here." },
		saved: { title: "Nothing saved yet", description: "Tap the bookmark on any job to keep it here." },
		applications: { title: "No applications yet", description: "Open a job and apply. We'll track it and remind you to follow up after a week." },
	};
	return (
		<Empty className="rounded-xl border">
			<EmptyHeader>
				<EmptyMedia variant="icon">{tab === "applications" ? <Briefcase /> : <Inbox />}</EmptyMedia>
				<EmptyTitle>{copy[tab].title}</EmptyTitle>
				<EmptyDescription>{copy[tab].description}</EmptyDescription>
			</EmptyHeader>
			{tab === "new" && filtered && (
				<EmptyContent>
					<Button variant="outline" size="sm" onClick={onResetFilters}>
						Reset filters
					</Button>
				</EmptyContent>
			)}
		</Empty>
	);
}
