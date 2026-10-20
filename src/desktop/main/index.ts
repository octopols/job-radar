import { app, dialog } from "electron";
import { JobRadarApp } from "./app/job-radar-app.ts";

const jobRadar = new JobRadarApp();

void jobRadar.start().catch((error: unknown) => {
	console.error(error);
	jobRadar.abandon();
	dialog.showErrorBox("Job Radar could not start", error instanceof Error ? error.message : String(error));
	app.exit(1);
});
