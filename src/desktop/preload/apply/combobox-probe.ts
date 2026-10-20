import type { OptionMatch, Point } from "../../../shared/ipc/apply.ts";
import { FieldLocator } from "./field-locator.ts";
import { FormScanner } from "./form-scanner.ts";
import { PageDom } from "./page-dom.ts";

const MAX_OPTIONS = 300;

export class ComboboxProbe {
	static locate(fieldId: string): Point | null {
		const [input] = FieldLocator.find(fieldId);
		const control = input?.closest('[class*="control"]') ?? input;
		return control ? PageDom.center(control) : null;
	}

	static options(fieldId: string): string[] {
		const [input] = FieldLocator.find(fieldId);
		const options = input ? FormScanner.optionsFor(input).map((option) => PageDom.clean(option.textContent)).filter(Boolean) : [];
		return [...new Set(options)].slice(0, MAX_OPTIONS);
	}

	static locateOption(fieldId: string, value: string): OptionMatch | null {
		const [input] = FieldLocator.find(fieldId);
		const options = input ? FormScanner.optionsFor(input) : [];
		const wanted = value.toLowerCase();
		const text = (option: HTMLElement) => PageDom.clean(option.textContent).toLowerCase();
		const unique = (matches: HTMLElement[]) => (matches.length === 1 ? matches[0] : undefined);
		const match =
			options.find((option) => text(option) === wanted) ??
			unique(options.filter((option) => text(option).startsWith(wanted))) ??
			unique(options.filter((option) => text(option).includes(wanted)));
		return match ? { point: PageDom.center(match), text: PageDom.clean(match.textContent), isTopOption: match === options[0] } : null;
	}

	static shown(fieldId: string): string {
		const [input] = FieldLocator.find(fieldId);
		return PageDom.clean(input?.closest('[class*="control"]')?.textContent);
	}
}
