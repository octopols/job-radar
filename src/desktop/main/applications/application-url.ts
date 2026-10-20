import { app } from "electron";

export class ApplicationUrl {
	static for(postingUrl: string): string {
		if (!app.isPackaged && process.env.JOB_RADAR_APPLY_URL_OVERRIDE) {
			return process.env.JOB_RADAR_APPLY_URL_OVERRIDE;
		}
		const parsed = new URL(postingUrl);
		const path = parsed.pathname.replace(/\/$/, "");
		if (parsed.hostname === "jobs.lever.co" && !path.endsWith("/apply")) {
			parsed.pathname = `${path}/apply`;
		}
		if (parsed.hostname === "jobs.ashbyhq.com" && !path.endsWith("/application")) {
			parsed.pathname = `${path}/application`;
		}
		return parsed.toString();
	}
}
