import { X } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { cn } from "@/lib/utils";

interface TagInputProps {
	values: string[];
	onChange: (values: string[]) => void;
	placeholder: string;
	id?: string;
	className?: string;
}

export function TagInput({ values, onChange, placeholder, id, className }: TagInputProps) {
	const [draft, setDraft] = useState("");

	const add = (raw: string) => {
		const additions = raw
			.split(",")
			.map((value) => value.trim())
			.filter((value) => value && !values.some((existing) => existing.toLowerCase() === value.toLowerCase()));
		if (additions.length > 0) {
			onChange([...values, ...additions]);
		}
		setDraft("");
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter" || event.key === ",") {
			event.preventDefault();
			add(draft);
		} else if (event.key === "Backspace" && draft === "" && values.length > 0) {
			onChange(values.slice(0, -1));
		}
	};

	return (
		<div
			className={cn(
				"flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border bg-transparent px-2 py-1.5 text-sm shadow-xs transition-[color,box-shadow]",
				"focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50 dark:bg-input/30",
				className,
			)}
		>
			{values.map((value) => (
				<span key={value} className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">
					{value}
					<button type="button" className="text-muted-foreground hover:text-foreground" aria-label={`Remove ${value}`} onClick={() => onChange(values.filter((item) => item !== value))}>
						<X className="size-3" />
					</button>
				</span>
			))}
			<input
				id={id}
				value={draft}
				placeholder={values.length === 0 ? placeholder : "Add more"}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={onKeyDown}
				onBlur={() => add(draft)}
				className="min-w-24 flex-1 bg-transparent py-0.5 outline-none placeholder:text-muted-foreground"
			/>
		</div>
	);
}
