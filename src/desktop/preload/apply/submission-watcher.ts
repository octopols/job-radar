import { ipcRenderer } from "electron";
import { APPLY_IPC } from "../../../shared/ipc/apply.ts";
import { AnswerCollector } from "./answer-collector.ts";
import { PageDom } from "./page-dom.ts";

const CONFIRMATION_TEXT =
	/thank you for (applying|your application|submitting)|application (has been |was )?(submitted|received)|we('ve| have) received your application|successfully (applied|submitted)/i;
const CONFIRMATION_URL = /thank|confirm|success|submitted|applied/i;
const SUBMIT_WATCH_MS = 90_000;

const SUBMIT_CLICKED_KEY = "job-radar-submit-clicked-at";

export class SubmissionWatcher {
	#armedAt = 0;
	#reported = false;

	start(): void {
		this.#armedAt = Number(sessionStorage.getItem(SUBMIT_CLICKED_KEY) ?? 0);
		document.addEventListener(
			"click",
			(event) => {
				const target = (event.target as Element | null)?.closest("button, input[type='submit'], [role='button']");
				if (PageDom.isSubmitButton(target)) {
					this.#armedAt = Date.now();
					sessionStorage.setItem(SUBMIT_CLICKED_KEY, String(this.#armedAt));
					ipcRenderer.send(APPLY_IPC.submitClicked, AnswerCollector.collect());
				}
			},
			true,
		);
		new MutationObserver(() => this.#check()).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
		this.#check();
	}

	#check(): void {
		if (this.#reported || Date.now() - this.#armedAt > SUBMIT_WATCH_MS) {
			return;
		}
		if (CONFIRMATION_TEXT.test(document.body?.innerText ?? "") || CONFIRMATION_URL.test(location.pathname)) {
			this.#reported = true;
			ipcRenderer.send(APPLY_IPC.submitted);
		}
	}
}
