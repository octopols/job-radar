import { RadarIcon } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider.tsx";
import type { SeekerSnapshot } from "@shared/types/seeker.ts";
import type { BoardStatus } from "@shared/types/board.ts";
import { SettingsMenu } from "@/features/settings/SettingsMenu.tsx";
import { NotificationsPopover } from "@/features/settings/NotificationsPopover.tsx";
import type { DesktopSettingsView } from "@shared/ipc/desktop-bridge.ts";
import { desktop } from "@/lib/desktop.ts";
import type { Guard, SeekerConnection } from "@/lib/rivet.ts";
import { StatusPill } from "@/features/layout/StatusPill.tsx";

interface HeaderProps {
	connected: boolean;
	boards: BoardStatus[];
	snapshot: SeekerSnapshot | null;
	connection: SeekerConnection | null;
	guard: Guard;
	ready: boolean;
	onPreferences: () => void;
	onCompanies: () => void;
	onApplicationDetails: () => void;
	onAutoApply: () => void;
	desktopSettings: DesktopSettingsView | null;
	onDesktopSettingsChanged: () => Promise<void>;
}

export function Header({ connected, boards, snapshot, connection, guard, ready, onPreferences, onCompanies, onApplicationDetails, onAutoApply, desktopSettings, onDesktopSettingsChanged }: HeaderProps) {
	const { resolved } = useTheme();
	useEffect(() => desktop?.setTitleBarTheme(resolved === "dark"), [resolved]);

	return (
		<header
			className={cn(
				"app-titlebar sticky top-0 z-30 border-b",
				desktop ? "bg-background" : "bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60",
			)}
		>
			<div className={cn("mx-auto flex max-w-5xl items-center gap-3 px-4", desktop ? "h-12" : "h-14")}>
				<div className="flex items-center gap-2">
					<div className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
						<RadarIcon className="size-4" />
					</div>
					<span className="font-semibold tracking-tight max-sm:sr-only">Job Radar</span>
				</div>
				{ready && <StatusPill connected={connected} boards={boards} onClick={onCompanies} />}
				<div className="ml-auto flex items-center gap-1">
					{ready && <NotificationsPopover snapshot={snapshot} connection={connection} guard={guard} />}
					<SettingsMenu
						ready={ready}
						onPreferences={onPreferences}
						onCompanies={onCompanies}
						onApplicationDetails={onApplicationDetails}
						onAutoApply={onAutoApply}
						desktopSettings={desktopSettings}
						onDesktopSettingsChanged={onDesktopSettingsChanged}
					/>
				</div>
			</div>
		</header>
	);
}
