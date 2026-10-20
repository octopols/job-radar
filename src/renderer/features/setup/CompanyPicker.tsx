import { BoardKey } from "@shared/board-key.ts";
import { Catalog, FEEDS } from "@shared/catalog.ts";
import type { CatalogBoard } from "@shared/types/board.ts";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { CompanyFinderInput } from "@/features/companies/CompanyFinderInput.tsx";
import { StepHeading } from "@/features/setup/StepHeading.tsx";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";
import { Selection } from "@/lib/selection.ts";
import { cn } from "@/lib/utils";

interface CompanyChoice {
	boardKey: string;
	company: string;
}

interface CompanyPickerProps {
	catalog: readonly CatalogBoard[];
	connection: SeekerConnection | null;
	guard: Guard;
}

export function CompanyPicker({ catalog, connection, guard }: CompanyPickerProps) {
	const catalogChoices = catalog.map((board) => ({ boardKey: BoardKey.of(board), company: board.company }));
	const [addedChoices, setAddedChoices] = useState<CompanyChoice[]>([]);
	const [selected, setSelected] = useState<Set<string>>(() => new Set(catalogChoices.map((choice) => choice.boardKey)));
	const [feeds, setFeeds] = useState<Set<string>>(() => new Set(Catalog.feedKeys()));
	const [starting, setStarting] = useState(false);

	const choices = [...catalogChoices, ...addedChoices];
	const choiceKeys = choices.map((choice) => choice.boardKey);
	const allSelected = choiceKeys.every((boardKey) => selected.has(boardKey));

	const addCompany = (choice: CompanyChoice) => {
		setAddedChoices((current) => (current.some((added) => added.boardKey === choice.boardKey) ? current : [...current, choice]));
		setSelected((current) => new Set([...current, choice.boardKey]));
	};

	const startWatching = () =>
		guard(async () => {
			setStarting(true);
			try {
				await connection?.follow([...selected, ...feeds]);
			} finally {
				setStarting(false);
			}
		});

	return (
		<section className="flex flex-col gap-6">
			<StepHeading
				title="Pick the companies to watch"
				description="We check each company's careers page around the clock and only show you openings that fit. You can add your own later."
			/>
			<div className="flex items-center justify-between text-sm">
				<span className="text-muted-foreground">
					{choiceKeys.filter((boardKey) => selected.has(boardKey)).length} of {choiceKeys.length} companies selected
				</span>
				<Button variant="ghost" size="sm" onClick={() => setSelected(allSelected ? new Set() : new Set(choiceKeys))}>
					{allSelected ? "Clear all" : "Select all"}
				</Button>
			</div>
			<CompanyFinderInput connection={connection} guard={guard} follows={[...selected]} onWatch={async (board) => addCompany({ boardKey: board.key, company: board.company })} />
			<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
				{choices.map(({ boardKey, company }) => {
					const isSelected = selected.has(boardKey);
					return (
						<button
							key={boardKey}
							type="button"
							aria-pressed={isSelected}
							onClick={() => setSelected((current) => Selection.toggled(current, boardKey))}
							className={cn(
								"flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
								isSelected ? "border-foreground/20 bg-secondary font-medium" : "text-muted-foreground hover:bg-accent",
							)}
						>
							{company}
							{isSelected && <Check className="size-4 shrink-0" />}
						</button>
					);
				})}
			</div>
			<div className="flex flex-col gap-3 rounded-xl border p-4">
				<div>
					<p className="text-sm font-medium">Also search job feeds</p>
					<p className="text-xs text-muted-foreground">Startups and remote roles that company boards miss. Only jobs that fit you are kept.</p>
				</div>
				{FEEDS.map((feed) => {
					const feedKey = BoardKey.of(feed);
					return (
						<label key={feedKey} className="flex items-center justify-between gap-3 text-sm">
							<span>
								{feed.name}
								<span className="block text-xs text-muted-foreground">{feed.description}</span>
							</span>
							<Switch checked={feeds.has(feedKey)} onCheckedChange={(checked) => setFeeds((current) => Selection.toggled(current, feedKey, checked))} />
						</label>
					);
				})}
			</div>
			<Button size="lg" disabled={selected.size + feeds.size === 0 || starting || !connection} onClick={startWatching}>
				Show my matches
			</Button>
		</section>
	);
}
