import { ipcRenderer } from "electron";
import { APPLY_IPC, type ApplyBannerState } from "../../../shared/ipc/apply.ts";
import { BRAND, FIELD_ATTRIBUTE } from "./page-dom.ts";

const STYLES = `
	:host { all: initial; }
	.bar { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); z-index: 2147483647; width: min(720px, calc(100vw - 32px));
		background: #18181b; color: #fafafa; border: 1px solid #3f3f46; border-radius: 14px; box-shadow: 0 12px 40px rgb(0 0 0 / 0.35);
		font: 13px/1.45 "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif; padding: 12px 14px; display: flex; flex-direction: column; gap: 8px; }
	.row { display: flex; align-items: center; gap: 10px; }
	.mark { width: 22px; height: 22px; flex: none; border-radius: 6px; background: ${BRAND}; display: grid; place-items: center; }
	.mark svg { width: 14px; height: 14px; }
	.title { font-weight: 600; }
	.detail { color: #a1a1aa; }
	.text { flex: 1; min-width: 0; }
	.action { flex: none; border: 0; border-radius: 8px; padding: 6px 12px; font: inherit; font-weight: 600; cursor: pointer; background: ${BRAND}; color: #fff; }
	.action.quiet { background: #27272a; color: #fafafa; }
	.bar.busy { pointer-events: none; }
	.chips { display: flex; flex-wrap: wrap; gap: 6px; max-height: 84px; overflow: auto; }
	.chip { border: 1px solid ${BRAND}; background: transparent; color: #fdba74; border-radius: 999px; padding: 2px 10px; font: inherit; font-size: 12px; cursor: pointer; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.chip.glance { border-color: #52525b; color: #a1a1aa; }
	.spin { animation: spin 1s linear infinite; transform-origin: 50% 50%; }
	@keyframes spin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { .spin { animation: none; } }
`;

export class ApplyBanner {
	#root: ShadowRoot | null = null;

	render(state: ApplyBannerState): void {
		const root = this.#ensureRoot();
		const needsYou = state.needsYou
			.map((item) => `<button class="chip ${item.kind}" data-target="${item.fieldId}" title="${ApplyBanner.#escape(item.note)}">${ApplyBanner.#escape(item.label || "Unlabelled field")}</button>`)
			.join("");
		root.innerHTML = `
			<style>${STYLES}</style>
			<div class="bar ${state.busy ? "busy" : ""}" role="status">
				<div class="row">
					<div class="mark"><svg viewBox="0 0 64 64" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"><circle cx="32" cy="32" r="18"/><path class="${state.busy ? "spin" : ""}" d="M32 32 44 20"/></svg></div>
					<div class="text"><div class="title">${ApplyBanner.#escape(state.title)}</div><div class="detail">${ApplyBanner.#escape(state.detail)}</div></div>
					${state.action ? `<button class="action ${state.busy ? "quiet" : ""}" data-action="fill">${ApplyBanner.#escape(state.action)}</button>` : ""}
				</div>
				${needsYou ? `<div class="chips">${needsYou}</div>` : ""}
			</div>`;
		root.querySelector("[data-action='fill']")?.addEventListener("click", () => ipcRenderer.send(APPLY_IPC.fillRequested));
		for (const chip of root.querySelectorAll<HTMLElement>(".chip")) {
			chip.addEventListener("click", () => {
				const target = document.querySelector<HTMLElement>(`[${FIELD_ATTRIBUTE}="${chip.dataset.target}"]`);
				target?.scrollIntoView({ behavior: "smooth", block: "center" });
				target?.focus();
			});
		}
	}

	#ensureRoot(): ShadowRoot {
		if (this.#root?.host.isConnected) {
			return this.#root;
		}
		const host = document.createElement("job-radar-banner");
		document.documentElement.appendChild(host);
		this.#root = host.attachShadow({ mode: "closed" });
		return this.#root;
	}

	static #escape(text: string): string {
		return text.replace(/[&<>"']/g, (character) => `&#${character.charCodeAt(0)};`);
	}
}
