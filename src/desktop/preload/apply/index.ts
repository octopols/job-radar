import { ipcRenderer } from "electron";
import { APPLY_IPC, type ApplyBannerState, type FieldOutcome } from "../../../shared/ipc/apply.ts";
import type { ApplicationAnswer, FormField } from "../../../shared/types/application.ts";
import { ApplyBanner } from "./apply-banner.ts";
import { ComboboxProbe } from "./combobox-probe.ts";
import { FieldLocator } from "./field-locator.ts";
import { FormFiller } from "./form-filler.ts";
import { FormScanner } from "./form-scanner.ts";
import { NavigationProbe } from "./navigation-probe.ts";
import { SubmissionWatcher } from "./submission-watcher.ts";
import { SubmitProbe } from "./submit-probe.ts";

const scanner = new FormScanner();
const filler = new FormFiller();
const banner = new ApplyBanner();

const handlers: Record<string, (...args: never[]) => unknown> = {
	[APPLY_IPC.count]: () => scanner.count(),
	[APPLY_IPC.scan]: () => scanner.scan(),
	[APPLY_IPC.mark]: (fieldIds: string[]) => fieldIds.filter((fieldId) => FieldLocator.find(fieldId).length > 0),
	[APPLY_IPC.fill]: (fields: FormField[], answers: ApplicationAnswer[]) => filler.fill(fields, answers),
	[APPLY_IPC.markOutcomes]: (outcomes: FieldOutcome[]) => {
		for (const outcome of outcomes) {
			FormFiller.mark(FieldLocator.find(outcome.fieldId), FormFiller.markState(outcome.filled, outcome.note), outcome.note);
		}
		return null;
	},
	[APPLY_IPC.locate]: (fieldId: string) => ComboboxProbe.locate(fieldId),
	[APPLY_IPC.options]: (fieldId: string) => ComboboxProbe.options(fieldId),
	[APPLY_IPC.locateOption]: (fieldId: string, value: string) => ComboboxProbe.locateOption(fieldId, value),
	[APPLY_IPC.shown]: (fieldId: string) => ComboboxProbe.shown(fieldId),
	[APPLY_IPC.navigationCandidates]: () => NavigationProbe.candidates(),
	[APPLY_IPC.locateCandidate]: (index: number) => NavigationProbe.locate(index),
	[APPLY_IPC.locateSubmit]: () => SubmitProbe.locateSubmit(),
	[APPLY_IPC.challenge]: () => SubmitProbe.challenge(),
	[APPLY_IPC.rejected]: () => SubmitProbe.rejected(),
};

for (const [channel, handle] of Object.entries(handlers)) {
	ipcRenderer.on(channel, (_event, requestId: number, ...args: unknown[]) => ipcRenderer.send(APPLY_IPC.reply, requestId, handle(...(args as never[]))));
}
ipcRenderer.on(APPLY_IPC.banner, (_event, state: ApplyBannerState) => banner.render(state));

window.addEventListener("DOMContentLoaded", () => new SubmissionWatcher().start());
