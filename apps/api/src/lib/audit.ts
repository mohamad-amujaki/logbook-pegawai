import { auditLog, db } from "@logbook/db";
import type { Authed } from "../middleware/auth";
import { buatId } from "./id";

export async function catatAudit(
	user: Authed,
	targetAkunId: string,
	aksi: string,
	opsi: { alasan?: string; sebelum?: unknown; sesudah?: unknown } = {},
) {
	await db.insert(auditLog).values({
		id: buatId("audit"),
		aktorAkunId: user.akunId,
		targetAkunId,
		aksi,
		alasan: opsi.alasan,
		sebelumJson: opsi.sebelum === undefined ? null : JSON.stringify(opsi.sebelum),
		sesudahJson: opsi.sesudah === undefined ? null : JSON.stringify(opsi.sesudah),
		createdAt: new Date().toISOString(),
	});
}
