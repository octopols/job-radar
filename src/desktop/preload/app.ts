import { contextBridge, ipcRenderer } from "electron";
import type { ApplicationStatus } from "../../shared/ipc/apply.ts";
import { type DesktopBridge, ENDPOINT_ARGUMENT, IPC } from "../../shared/ipc/desktop-bridge.ts";

const endpoint = process.argv.find((argument) => argument.startsWith(ENDPOINT_ARGUMENT))?.slice(ENDPOINT_ARGUMENT.length) ?? "";

const bridge: DesktopBridge = {
	endpoint,
	platform: process.platform,
	getSettings: () => ipcRenderer.invoke(IPC.getSettings),
	useClaudeCode: () => ipcRenderer.invoke(IPC.useClaudeCode),
	useApiKey: (apiKey) => ipcRenderer.invoke(IPC.useApiKey, apiKey),
	setOpenAtLogin: (enabled) => ipcRenderer.invoke(IPC.setOpenAtLogin, enabled),
	focusWindow: () => ipcRenderer.send(IPC.focusWindow),
	openDataFolder: () => ipcRenderer.send(IPC.openDataFolder),
	resetEverything: () => ipcRenderer.invoke(IPC.resetEverything),
	setTitleBarTheme: (dark) => ipcRenderer.send(IPC.setTitleBarTheme, dark),
	startApplication: (request) => ipcRenderer.send(IPC.startApplication, request),
	watchProfile: (seekerKey) => ipcRenderer.send(IPC.watchProfile, seekerKey),
	onApplicationStatus: (listener) => {
		const forward = (_event: unknown, status: ApplicationStatus) => listener(status);
		ipcRenderer.on(IPC.applicationStatus, forward);
		return () => ipcRenderer.off(IPC.applicationStatus, forward);
	},
};

contextBridge.exposeInMainWorld("jobRadarDesktop", bridge);
