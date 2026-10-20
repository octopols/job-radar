import type { DesktopSettingsView } from "@shared/ipc/desktop-bridge.ts";
import { useCallback, useEffect, useState } from "react";
import { desktop } from "@/lib/desktop.ts";

interface DesktopSettingsState {
	settings: DesktopSettingsView | null;
	refresh: () => Promise<void>;
}

export function useDesktopSettings(): DesktopSettingsState {
	const [settings, setSettings] = useState<DesktopSettingsView | null>(null);
	const refresh = useCallback(async () => {
		if (desktop) {
			setSettings(await desktop.getSettings());
		}
	}, []);
	useEffect(() => {
		void refresh();
	}, [refresh]);
	return { settings, refresh };
}
