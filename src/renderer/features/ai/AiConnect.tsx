import { Check, KeyRound, Terminal } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import type { AiCheck, DesktopSettingsView } from "@shared/ipc/desktop-bridge.ts";
import { desktop } from "@/lib/desktop.ts";

interface AiConnectProps {
	settings: DesktopSettingsView;
	onConnected: () => Promise<void>;
}

export function AiConnect({ settings, onConnected }: AiConnectProps) {
	const [busy, setBusy] = useState<"claude-code" | "anthropic-api" | null>(null);
	const [error, setError] = useState<{ kind: string; message: string } | null>(null);
	const [apiKey, setApiKey] = useState("");
	const active = settings.ai.configured ? settings.ai.kind : null;

	const connect = async (kind: "claude-code" | "anthropic-api", check: () => Promise<AiCheck>) => {
		setBusy(kind);
		setError(null);
		try {
			const result = await check();
			if (result.ok) {
				setApiKey("");
				await onConnected();
			} else {
				setError({ kind, message: result.error });
			}
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="flex flex-col gap-3">
			<Option
				icon={Terminal}
				title="Claude Code"
				description="Uses your Claude subscription through Claude Code on this computer. Install it and sign in once by running claude in a terminal."
				active={active === "claude-code"}
				error={error?.kind === "claude-code" ? error.message : null}
			>
				<Button size="sm" variant={active === "claude-code" ? "outline" : "default"} disabled={busy !== null} onClick={() => connect("claude-code", () => desktop!.useClaudeCode())}>
					{busy === "claude-code" && <Spinner />}
					{active === "claude-code" ? "Check again" : "Use Claude Code"}
				</Button>
			</Option>

			<Option
				icon={KeyRound}
				title="Anthropic API key"
				description={
					<>
						Pay per use with a key from the{" "}
						<a className="underline underline-offset-2" href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer">
							Claude Console
						</a>
						. It's stored encrypted on this computer.
					</>
				}
				active={active === "anthropic-api"}
				error={error?.kind === "anthropic-api" ? error.message : null}
			>
				<form
					className="flex gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						void connect("anthropic-api", () => desktop!.useApiKey(apiKey));
					}}
				>
					<Input
						type="password"
						autoComplete="off"
						placeholder={settings.ai.hasApiKey ? "Replace saved key" : "sk-ant-..."}
						value={apiKey}
						onChange={(event) => setApiKey(event.target.value)}
						aria-label="Anthropic API key"
					/>
					<Button size="sm" type="submit" className="h-9" disabled={busy !== null || apiKey.trim().length === 0}>
						{busy === "anthropic-api" && <Spinner />}
						Save key
					</Button>
				</form>
			</Option>
		</div>
	);
}

interface OptionProps {
	icon: typeof Terminal;
	title: string;
	description: ReactNode;
	active: boolean;
	error: string | null;
	children: ReactNode;
}

function Option({ icon: Icon, title, description, active, error, children }: OptionProps) {
	return (
		<div className={cn("flex flex-col gap-3 rounded-xl border p-4", active && "border-primary bg-primary/5")}>
			<div className="flex gap-3">
				<div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
					<Icon className="size-4" />
				</div>
				<div className="flex flex-col gap-0.5">
					<p className="flex items-center gap-1.5 font-medium">
						{title}
						{active && (
							<span className="flex items-center gap-1 text-xs font-normal text-primary">
								<Check className="size-3" />
								In use
							</span>
						)}
					</p>
					<p className="text-sm text-muted-foreground">{description}</p>
				</div>
			</div>
			{children}
			{error && <p className="text-sm text-destructive">{error}</p>}
		</div>
	);
}
