import { Building2, Check, Database, IdCard, Monitor, Moon, Power, Settings, SlidersHorizontal, Sparkles, Sun, WandSparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type ThemePreference, useTheme } from "@/providers/theme-provider.tsx";
import type { DesktopSettingsView } from "@shared/ipc/desktop-bridge.ts";
import { AiConnect } from "@/features/ai/AiConnect.tsx";
import { desktop } from "@/lib/desktop.ts";
import { YourDataDialog } from "@/features/settings/YourDataDialog.tsx";

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
	{ value: "light", label: "Light", icon: Sun },
	{ value: "dark", label: "Dark", icon: Moon },
	{ value: "system", label: "System", icon: Monitor },
];

interface SettingsMenuProps {
	ready: boolean;
	onPreferences: () => void;
	onCompanies: () => void;
	onApplicationDetails: () => void;
	onAutoApply: () => void;
	desktopSettings: DesktopSettingsView | null;
	onDesktopSettingsChanged: () => Promise<void>;
}

export function SettingsMenu({ ready, onPreferences, onCompanies, onApplicationDetails, onAutoApply, desktopSettings, onDesktopSettingsChanged }: SettingsMenuProps) {
	const { preference, setPreference } = useTheme();
	const [aiOpen, setAiOpen] = useState(false);
	const [dataOpen, setDataOpen] = useState(false);

	const toggleOpenAtLogin = async () => {
		if (desktop && desktopSettings) {
			await desktop.setOpenAtLogin(!desktopSettings.openAtLogin);
			await onDesktopSettingsChanged();
		}
	};

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<Button variant="ghost" size="icon" aria-label="Settings">
						<Settings className="size-4" />
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-56">
					{ready && (
						<>
							<DropdownMenuItem onSelect={onPreferences}>
								<SlidersHorizontal className="size-4" />
								Preferences
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={onCompanies}>
								<Building2 className="size-4" />
								Companies
							</DropdownMenuItem>
							{desktopSettings && (
								<DropdownMenuItem onSelect={onApplicationDetails}>
									<IdCard className="size-4" />
									Application details
								</DropdownMenuItem>
							)}
							{desktopSettings && (
								<DropdownMenuItem onSelect={onAutoApply}>
									<WandSparkles className="size-4" />
									Auto-apply
								</DropdownMenuItem>
							)}
							<DropdownMenuSeparator />
						</>
					)}
					{desktopSettings && (
						<>
							<DropdownMenuItem onSelect={() => setAiOpen(true)}>
								<Sparkles className="size-4" />
								Claude connection
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => void toggleOpenAtLogin()}>
								<Power className="size-4" />
								Start at login
								{desktopSettings.openAtLogin && <Check className="ml-auto size-4" />}
							</DropdownMenuItem>
							<DropdownMenuItem onSelect={() => setDataOpen(true)}>
								<Database className="size-4" />
								Your data
							</DropdownMenuItem>
							<DropdownMenuSeparator />
						</>
					)}
					<DropdownMenuLabel>Theme</DropdownMenuLabel>
					{THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
						<DropdownMenuItem key={value} onSelect={() => setPreference(value)}>
							<Icon className="size-4" />
							{label}
							{preference === value && <Check className="ml-auto size-4" />}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{desktopSettings && <YourDataDialog open={dataOpen} onOpenChange={setDataOpen} settings={desktopSettings} />}
			{desktopSettings && (
				<Dialog open={aiOpen} onOpenChange={setAiOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Claude connection</DialogTitle>
							<DialogDescription>Choose how Job Radar reaches Claude for reading resumes, finding job boards and explaining fits.</DialogDescription>
						</DialogHeader>
						<AiConnect settings={desktopSettings} onConnected={onDesktopSettingsChanged} />
					</DialogContent>
				</Dialog>
			)}
		</>
	);
}
