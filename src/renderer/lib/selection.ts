export class Selection {
	static toggled<T>(current: ReadonlySet<T>, item: T, include = !current.has(item)): Set<T> {
		const next = new Set(current);
		if (include) {
			next.add(item);
		} else {
			next.delete(item);
		}
		return next;
	}
}
