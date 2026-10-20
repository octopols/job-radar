import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TOGGLE_SELECTED } from "@/lib/styles.ts";

export interface ChoiceOption<Value extends string> {
	value: Value;
	label: string;
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
	return (
		<section className="flex flex-col gap-4">
			<div>
				<h3 className="text-sm font-semibold">{title}</h3>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
			</div>
			{children}
		</section>
	);
}

interface ChoiceFieldProps<Value extends string> {
	label: string;
	value: Value;
	options: ChoiceOption<Value>[];
	onChange: (value: Value) => void;
}

export function ChoiceField<Value extends string>({ label, value, options, onChange }: ChoiceFieldProps<Value>) {
	return (
		<div className="flex flex-col gap-2">
			<span className="text-sm font-medium">{label}</span>
			<ToggleGroup type="single" variant="outline" value={value} onValueChange={(next) => next && onChange(next as Value)} className="w-full" aria-label={label}>
				{options.map((option) => (
					<ToggleGroupItem key={option.value} value={option.value} className={`flex-1 ${TOGGLE_SELECTED}`}>
						{option.label}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</div>
	);
}

interface LabeledFieldProps {
	label: string;
	hint?: string;
	required?: boolean;
	containsSeveralControls?: boolean;
	children: ReactNode;
}

export function LabeledField({ label, hint, required, containsSeveralControls, children }: LabeledFieldProps) {
	const Wrapper = containsSeveralControls ? "div" : "label";
	return (
		<Wrapper className="flex flex-col gap-2">
			<span className="text-sm font-medium">
				{label}
				{required && <span className="font-normal text-muted-foreground"> (required)</span>}
			</span>
			{children}
			{hint && <span className="text-xs text-muted-foreground">{hint}</span>}
		</Wrapper>
	);
}
