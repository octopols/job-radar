import { SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_FILTERS, type FeedFilters, type PostedWithin } from "@/features/feed/feed-view.ts";
import type { FitLevel } from "@/lib/format.ts";
import { TOGGLE_SELECTED } from "@/lib/styles.ts";

interface FeedFiltersPopoverProps {
	filters: FeedFilters;
	onChange: (filters: FeedFilters) => void;
	activeCount: number;
}

export function FeedFiltersPopover({ filters, onChange, activeCount }: FeedFiltersPopoverProps) {
	const set = <K extends keyof FeedFilters>(key: K, value: FeedFilters[K]) => onChange({ ...filters, [key]: value });
	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="outline" size="sm">
					<SlidersHorizontal className="size-4" />
					Filters
					{activeCount > 0 && <span className="rounded-full bg-primary px-1.5 text-[11px] text-primary-foreground tabular-nums">{activeCount}</span>}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="flex w-72 flex-col gap-4">
				<FilterGroup label="Fit">
					<ToggleGroup type="single" variant="outline" size="sm" value={filters.fit} onValueChange={(value) => value && set("fit", value as FitLevel)} className="w-full">
						<ToggleGroupItem value="strong" className={`flex-1 ${TOGGLE_SELECTED}`}>Strong</ToggleGroupItem>
						<ToggleGroupItem value="good" className={`flex-1 ${TOGGLE_SELECTED}`}>Good+</ToggleGroupItem>
						<ToggleGroupItem value="stretch" className={`flex-1 ${TOGGLE_SELECTED}`}>All</ToggleGroupItem>
					</ToggleGroup>
				</FilterGroup>
				<FilterGroup label="Posted">
					<ToggleGroup
						type="single"
						variant="outline"
						size="sm"
						value={filters.postedWithin}
						onValueChange={(value) => value && set("postedWithin", value as PostedWithin)}
						className="w-full"
					>
						<ToggleGroupItem value="week" className={`flex-1 ${TOGGLE_SELECTED}`}>Week</ToggleGroupItem>
						<ToggleGroupItem value="month" className={`flex-1 ${TOGGLE_SELECTED}`}>Month</ToggleGroupItem>
						<ToggleGroupItem value="any" className={`flex-1 ${TOGGLE_SELECTED}`}>Any time</ToggleGroupItem>
					</ToggleGroup>
				</FilterGroup>
				<label className="flex items-center justify-between gap-3 text-sm">
					Remote only
					<Switch checked={filters.remoteOnly} onCheckedChange={(checked) => set("remoteOnly", checked)} />
				</label>
				<label className="flex items-center justify-between gap-3 text-sm">
					Hide jobs with warnings
					<Switch checked={filters.hideWarnings} onCheckedChange={(checked) => set("hideWarnings", checked)} />
				</label>
				{activeCount > 0 && (
					<Button variant="ghost" size="sm" className="self-start" onClick={() => onChange(DEFAULT_FILTERS)}>
						Reset filters
					</Button>
				)}
			</PopoverContent>
		</Popover>
	);
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-xs font-medium text-muted-foreground">{label}</span>
			{children}
		</div>
	);
}
