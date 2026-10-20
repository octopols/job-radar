const { app, BrowserWindow } = require("electron");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

const ASSETS = join(__dirname, "..", "assets", "installer");
const BRAND = "#c2410c";
const MARK = `<svg viewBox="0 0 64 64" width="100%" height="100%"><rect width="64" height="64" rx="14" fill="${BRAND}"/><g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"><circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="9"/><path d="M32 32 46 18"/></g><circle cx="32" cy="32" r="3" fill="#fff"/></svg>`;

const FONT = "'Segoe UI Variable Display', 'Segoe UI', sans-serif";

const SIDEBAR = `<html><body style="margin:0;width:164px;height:314px;overflow:hidden;background:#09090b;font-family:${FONT};position:relative">
	<svg width="164" height="314" style="position:absolute;inset:0" viewBox="0 0 164 314">
		<defs><radialGradient id="glow" cx="1" cy="1" r="0.9"><stop offset="0" stop-color="${BRAND}" stop-opacity="0.45"/><stop offset="1" stop-color="${BRAND}" stop-opacity="0"/></radialGradient></defs>
		<rect width="164" height="314" fill="url(#glow)"/>
		<g fill="none" stroke="${BRAND}" stroke-opacity="0.35" stroke-width="1.5">
			<circle cx="150" cy="300" r="40"/><circle cx="150" cy="300" r="80"/><circle cx="150" cy="300" r="120"/><circle cx="150" cy="300" r="160"/>
		</g>
		<path d="M150 300 L62 230" stroke="#fdba74" stroke-opacity="0.8" stroke-width="2" stroke-linecap="round"/>
		<circle cx="88" cy="252" r="3.5" fill="#fff"/>
	</svg>
	<div style="position:absolute;left:20px;top:28px;width:44px;height:44px">${MARK}</div>
	<div style="position:absolute;left:20px;top:86px;right:16px;color:#fafafa;font-size:19px;font-weight:600;letter-spacing:-0.01em">Job Radar</div>
	<div style="position:absolute;left:20px;top:114px;right:18px;color:#a1a1aa;font-size:11.5px;line-height:1.45">Jobs that fit you, the moment companies post them.</div>
</body></html>`;

const HEADER = `<html><body style="margin:0;width:150px;height:57px;overflow:hidden;background:#ffffff;font-family:${FONT};display:flex;align-items:center;justify-content:flex-end;gap:8px;padding-right:12px;box-sizing:border-box">
	<div style="width:26px;height:26px">${MARK}</div>
	<div style="color:#09090b;font-size:14px;font-weight:600">Job Radar</div>
</body></html>`;

const DMG = `<html><body style="margin:0;width:1080px;height:760px;overflow:hidden;background:#09090b;font-family:-apple-system,${FONT};position:relative">
	<svg width="1080" height="760" style="position:absolute;inset:0" viewBox="0 0 540 380">
		<defs><radialGradient id="glow" cx="0.5" cy="1.1" r="0.8"><stop offset="0" stop-color="${BRAND}" stop-opacity="0.35"/><stop offset="1" stop-color="${BRAND}" stop-opacity="0"/></radialGradient></defs>
		<rect width="540" height="380" fill="url(#glow)"/>
		<path d="M218 200 H318" stroke="#fdba74" stroke-width="3" stroke-linecap="round" stroke-dasharray="2 9"/>
		<path d="M310 190 L322 200 L310 210" fill="none" stroke="#fdba74" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
	</svg>
	<div style="position:absolute;top:64px;width:100%;text-align:center;color:#fafafa;font-size:34px;font-weight:600;letter-spacing:-0.01em">Drag Job Radar to Applications</div>
	<div style="position:absolute;bottom:56px;width:100%;text-align:center;color:#a1a1aa;font-size:22px">Then open it from Launchpad or your Applications folder.</div>
</body></html>`;

function bmp(image) {
	const { width, height } = image.getSize();
	const bgra = image.toBitmap();
	const rowSize = Math.ceil((width * 3) / 4) * 4;
	const pixels = Buffer.alloc(rowSize * height);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const source = (y * width + x) * 4;
			const target = (height - 1 - y) * rowSize + x * 3;
			pixels[target] = bgra[source];
			pixels[target + 1] = bgra[source + 1];
			pixels[target + 2] = bgra[source + 2];
		}
	}
	const header = Buffer.alloc(54);
	header.write("BM", 0);
	header.writeUInt32LE(54 + pixels.length, 2);
	header.writeUInt32LE(54, 10);
	header.writeUInt32LE(40, 14);
	header.writeInt32LE(width, 18);
	header.writeInt32LE(height, 22);
	header.writeUInt16LE(1, 26);
	header.writeUInt16LE(24, 28);
	header.writeUInt32LE(pixels.length, 34);
	return Buffer.concat([header, pixels]);
}

async function render(window, html, width, height) {
	window.setContentSize(width, height);
	await window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
	await new Promise((resolve) => setTimeout(resolve, 400));
	return (await window.webContents.capturePage({ x: 0, y: 0, width, height })).resize({ width, height });
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
	const window = new BrowserWindow({ width: 164, height: 314, show: false, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
	const sidebar = await render(window, SIDEBAR, 164, 314);
	writeFileSync(join(ASSETS, "installer-sidebar.bmp"), bmp(sidebar));
	writeFileSync(join(ASSETS, "installer-sidebar-preview.png"), sidebar.toPNG());
	const header = await render(window, HEADER, 150, 57);
	writeFileSync(join(ASSETS, "installer-header.bmp"), bmp(header));
	writeFileSync(join(ASSETS, "installer-header-preview.png"), header.toPNG());
	const dmg = await render(window, DMG, 1080, 760);
	writeFileSync(join(ASSETS, "dmg-background@2x.png"), dmg.toPNG());
	writeFileSync(join(ASSETS, "dmg-background.png"), dmg.resize({ width: 540, height: 380, quality: "best" }).toPNG());
	app.quit();
});
