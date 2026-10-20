self.addEventListener("push", (event) => {
	const message = event.data ? event.data.json() : { title: "Job Radar", body: "You have a new update.", url: "/", tag: "job-radar" };
	event.waitUntil(
		self.registration.showNotification(message.title, {
			body: message.body,
			tag: message.tag,
			data: { url: message.url },
			icon: "/icon.svg",
			badge: "/icon.svg",
		}),
	);
});

self.addEventListener("notificationclick", (event) => {
	event.notification.close();
	const target = new URL(event.notification.data?.url ?? "/", self.location.origin).href;
	event.waitUntil(
		self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
			const open = windows.find((window) => window.url.startsWith(self.location.origin));
			return open ? open.focus() : self.clients.openWindow(target);
		}),
	);
});
