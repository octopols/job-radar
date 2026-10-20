import type { Point } from "../../../shared/ipc/apply.ts";
import { FieldLocator } from "./field-locator.ts";
import { FormScanner } from "./form-scanner.ts";
import { PageDom } from "./page-dom.ts";

const CHALLENGE_FRAME = /recaptcha\/(api2|enterprise)\/bframe|hcaptcha\.com|challenges\.cloudflare\.com|arkoselabs|funcaptcha/i;
const CODE_PROMPT = /verification code|one[- ]time (pass)?code|enter the code|we sent (you )?a code|security code/i;
const MIN_CHALLENGE_SIZE = 100;

export class SubmitProbe {
	static locateSubmit(): Point | null {
		const [firstField] = FormScanner.lastScan.flatMap((field) => FieldLocator.find(field.id));
		const scope = firstField?.closest("form") ?? document;
		const buttons = [...scope.querySelectorAll<HTMLElement>("button, input[type='submit'], [role='button']")].filter(
			(button) => button.offsetParent !== null && PageDom.isSubmitButton(button),
		);
		const button = buttons.at(-1);
		return button ? PageDom.center(button) : null;
	}

	static challenge(): string | null {
		const frame = [...document.querySelectorAll("iframe")].find((candidate) => {
			const box = candidate.getBoundingClientRect();
			return CHALLENGE_FRAME.test(candidate.src) && box.width > MIN_CHALLENGE_SIZE && box.height > MIN_CHALLENGE_SIZE && getComputedStyle(candidate).visibility !== "hidden";
		});
		if (frame) {
			return "The site asked for a captcha.";
		}
		return CODE_PROMPT.test(document.body?.innerText ?? "") ? "The site asked for a verification code." : null;
	}

	static rejected(): string[] {
		return FormScanner.lastScan
			.filter((field) => FieldLocator.find(field.id).some((element) => element.getAttribute("aria-invalid") === "true"))
			.map((field) => field.label);
	}
}
