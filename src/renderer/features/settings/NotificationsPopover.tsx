import { Bell, BellOff, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import { desktop } from "@/lib/desktop.ts";
import { BrowserPush, type PushSupport } from "@/lib/browser-push.ts";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";

interface NotificationsPopoverProps {
	snapshot: SeekerSnapshot | null;
	connection: SeekerConnection | null;
	guard: Guard;
}

export function NotificationsPopover({ snapshot, connection, guard }: NotificationsPopoverProps) {
	const [support, setSupport] = useState<PushSupport>("supported");
	const [thisDevice, setThisDevice] = useState(false);
	const [busy, setBusy] = useState(false);
	const [minScore, setMinScore] = useState(75);

	const settings = snapshot?.notifications;
	const enabled = Boolean(settings?.enabled) && (desktop !== null || thisDevice);

	useEffect(() => {
		if (desktop) {
			return;
		}
		setSupport(BrowserPush.support());
		void BrowserPush.currentEndpoint().then((endpoint) => setThisDevice(endpoint !== null));
	}, [snapshot?.pushDevices]);

	useEffect(() => {
		if (settings) {
			setMinScore(settings.minScore);
		}
	}, [settings?.minScore]);

	const run = (work: () => Promise<unknown>) =>
		guard(async () => {
			setBusy(true);
			try {
				await work();
			} finally {
				setBusy(false);
				if (!desktop) {
					setThisDevice((await BrowserPush.currentEndpoint()) !== null);
				}
			}
		});

	const turnOn = async (current: SeekerConnection) => (desktop ? current.setNotificationsEnabled(true) : BrowserPush.enable(current));
	const turnOff = async (current: SeekerConnection) => (desktop ? current.setNotificationsEnabled(false) : BrowserPush.disable(current));
	const Icon = enabled ? BellRing : Bell;

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
					<Icon className="size-4" />
					{enabled && <span className="absolute top-2 right-2 size-1.5 rounded-full bg-success" />}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-80">
				<div className="flex flex-col gap-3 text-sm">
					<div>
						<p className="font-medium">Notifications</p>
						<p className="text-muted-foreground">
							{desktop
								? "Get new matches and follow-up reminders while Job Radar runs in the background. Closing the window keeps it running in the tray."
								: "Get new matches and follow-up reminders on this device, even when Job Radar is closed."}
						</p>
					</div>

					{support === "unsupported" ? (
						<p className="text-muted-foreground">This browser does not support push notifications.</p>
					) : support === "blocked" ? (
						<p className="text-warning">Notifications are blocked for this site. Allow them in your browser's site settings.</p>
					) : enabled ? (
						<div className="flex gap-2">
							<Button
								size="sm"
								variant="outline"
								disabled={busy || !connection}
								onClick={() =>
									run(async () => {
										const delivered = await connection?.sendTestNotification();
										toast(desktop || delivered ? "Test notification sent" : "Could not reach this device", {
											description: desktop || delivered ? undefined : "Check that your browser can reach its push service.",
										});
									})
								}
							>
								Send a test
							</Button>
							<Button size="sm" variant="ghost" disabled={busy || !connection} onClick={() => run(async () => connection && turnOff(connection))}>
								<BellOff className="size-4" />
								{desktop ? "Turn off" : "Turn off here"}
							</Button>
						</div>
					) : (
						<Button size="sm" disabled={busy || !connection} onClick={() => run(async () => connection && turnOn(connection))}>
							<BellRing className="size-4" />
							{desktop ? "Turn on notifications" : "Turn on for this device"}
						</Button>
					)}

					<Separator />
					<label className="flex flex-col gap-2">
						<span className="flex justify-between text-muted-foreground">
							<span>Notify me for matches with fit</span>
							<span className="font-medium text-foreground tabular-nums">{minScore}+</span>
						</span>
						<Slider
							min={40}
							max={100}
							step={5}
							value={[minScore]}
							onValueChange={([value]) => setMinScore(value ?? minScore)}
							onValueCommit={([value]) => guard(async () => connection?.setNotificationMinScore(value ?? minScore))}
							aria-label="Minimum fit for notifications"
						/>
					</label>
					{!desktop && (snapshot?.pushDevices ?? 0) > 0 && (
						<p className="text-xs text-muted-foreground">
							Notifying {snapshot?.pushDevices} {snapshot?.pushDevices === 1 ? "device" : "devices"}.
						</p>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}
