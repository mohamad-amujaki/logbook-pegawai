const ITERATIONS = 100_000;

function toHex(bytes: Uint8Array): string {
	return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
	const out = new Uint8Array(hex.length / 2);
	for (let i = 0; i < out.length; i++) {
		out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return out;
}

export async function hashPassword(plain: string): Promise<string> {
	const enc = new TextEncoder();
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const key = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
		key,
		256,
	);
	return `${toHex(salt)}$${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
	const [saltHex, hashHex] = stored.split("$");
	if (!saltHex || !hashHex) return false;
	const enc = new TextEncoder();
	const salt = fromHex(saltHex);
	const key = await crypto.subtle.importKey("raw", enc.encode(plain), "PBKDF2", false, [
		"deriveBits",
	]);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
		key,
		256,
	);
	const computed = toHex(new Uint8Array(bits));
	return computed === hashHex;
}
