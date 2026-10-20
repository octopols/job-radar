const { app, BrowserWindow } = require("electron");
const { writeFileSync } = require("node:fs");
const { join } = require("node:path");

const ASSETS = join(__dirname, "..", "assets");
const ICO_SIZES = [16, 20, 24, 32, 40, 48, 64, 128, 256];
const BRAND = "#c2410c";

function svg(size) {
	const small = size <= 24;
	const stroke = small ? 6 : 4;
	const rings = small ? '<circle cx="32" cy="32" r="18"/>' : '<circle cx="32" cy="32" r="18"/><circle cx="32" cy="32" r="9"/>';
	const radius = small ? 12 : 14;
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" rx="${radius}" fill="${BRAND}"/><g fill="none" stroke="#fff" stroke-width="${stroke}" stroke-linecap="round">${rings}<path d="M32 32 46 18"/></g><circle cx="32" cy="32" r="${small ? 4 : 3}" fill="#fff"/></svg>`;
}

async function render(window, size) {
	await window.loadURL(`data:text/html,${encodeURIComponent(`<html><body style="margin:0;background:transparent">${svg(size)}</body></html>`)}`);
	await new Promise((resolve) => setTimeout(resolve, 150));
	return (await window.webContents.capturePage({ x: 0, y: 0, width: size, height: size })).resize({ width: size, height: size });
}

function dib(image, size) {
	const header = Buffer.alloc(40);
	header.writeUInt32LE(40, 0);
	header.writeInt32LE(size, 4);
	header.writeInt32LE(size * 2, 8);
	header.writeUInt16LE(1, 12);
	header.writeUInt16LE(32, 14);
	const bgra = image.toBitmap();
	const rowBytes = size * 4;
	const pixels = Buffer.alloc(rowBytes * size);
	for (let row = 0; row < size; row++) {
		bgra.copy(pixels, (size - 1 - row) * rowBytes, row * rowBytes, (row + 1) * rowBytes);
	}
	const mask = Buffer.alloc(Math.ceil(size / 32) * 4 * size);
	return Buffer.concat([header, pixels, mask]);
}

function ico(images) {
	const header = Buffer.alloc(6);
	header.writeUInt16LE(1, 2);
	header.writeUInt16LE(images.length, 4);
	const entries = [];
	let offset = 6 + 16 * images.length;
	for (const { size, png } of images) {
		const entry = Buffer.alloc(16);
		entry.writeUInt8(size >= 256 ? 0 : size, 0);
		entry.writeUInt8(size >= 256 ? 0 : size, 1);
		entry.writeUInt16LE(1, 4);
		entry.writeUInt16LE(32, 6);
		entry.writeUInt32LE(png.length, 8);
		entry.writeUInt32LE(offset, 12);
		entries.push(entry);
		offset += png.length;
	}
	return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
}

app.disableHardwareAcceleration();
app.whenReady().then(async () => {
	const window = new BrowserWindow({ width: 512, height: 512, show: false, transparent: true, frame: false, useContentSize: true, webPreferences: { offscreen: true } });
	const images = [];
	for (const size of ICO_SIZES) {
		const image = await render(window, size);
		images.push({ size, png: size >= 256 ? image.toPNG() : dib(image, size), image });
	}
	writeFileSync(join(ASSETS, "icon.ico"), ico(images));
	writeFileSync(join(ASSETS, "icon.png"), (await render(window, 512)).toPNG());
	writeFileSync(join(ASSETS, "tray.png"), images.find((image) => image.size === 16).image.toPNG());
	writeFileSync(join(ASSETS, "tray@2x.png"), images.find((image) => image.size === 32).image.toPNG());
	app.quit();
});
