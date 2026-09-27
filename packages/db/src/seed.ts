import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashPassword } from "./password";
import { openSqlite } from "./client";
import { aktivitas, pegawai, produk, tahapan, timKerja, unitKerja } from "./schema";

const NIP_KEPALA = "198005022008122003";
const NIP_PO = "198702172009121001";

const TIM = [
	["TK-ORTALA", "Tim Kerja Organisasi dan Tata Laksana"],
	["TK-PENATAAN-ASN", "Tim Kerja Penataan ASN"],
	["TK-ADMIN-ASN", "Tim Kerja Administrasi ASN"],
	["TK-KINERJA-ASN", "Tim Kerja Pengelolaan Kinerja Pegawai ASN"],
	["TK-KARIER-ASN", "Tim Kerja Pengembangan Karier ASN"],
	["TK-TALENTA", "Tim Kerja Seleksi dan Penempatan Talenta"],
	["TK-DISIPLIN", "Tim Kerja Penegakan Disiplin dan Pemberian Penghargaan"],
	["TK-KP-KJ", "Tim Kerja Kenaikan Pangkat dan Kenaikan Jabatan"],
	["TK-SI-ASN", "Tim Kerja Sistem Informasi ASN"],
	["TK-DUKMAN", "Tim Kerja Dukungan Manajemen"],
] as const;

type DukRow = {
	namaLengkap: string;
	nip: string;
	pangkatGolongan: string;
	tmt: string;
	jabatan: string;
	unitKerja: string;
};

function id(prefix: string, raw: string) {
	return `${prefix}_${raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

async function main() {
	const db = openSqlite();
	const jsonPath = resolve(import.meta.dir, "../../../data/duk-pegawai.json");
	const rows = JSON.parse(readFileSync(jsonPath, "utf8")) as DukRow[];
	const now = new Date().toISOString();

	const eselonId = "unit_setjen";
	const unitId = "unit_osdm";
	await db
		.insert(unitKerja)
		.values({
			id: eselonId,
			kode: "SETJEN",
			nama: "Sekretariat Jenderal",
			indukId: null,
			status: "aktif",
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
	await db
		.insert(unitKerja)
		.values({
			id: unitId,
			kode: "OSDM",
			nama: "Biro Organisasi dan Sumber Daya Manusia",
			indukId: eselonId,
			status: "aktif",
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();

	for (const [i, [kode, nama]] of TIM.entries()) {
		await db
			.insert(timKerja)
			.values({
				id: id("tim", kode),
				kode,
				nama,
				unitKerjaId: unitId,
				status: "aktif",
				urutan: i + 1,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}

	for (const row of rows) {
		const hash = await hashPassword(row.nip);
		await db
			.insert(pegawai)
			.values({
				id: id("pg", row.nip),
				nip: row.nip,
				namaLengkap: row.namaLengkap,
				pangkatGolongan: row.pangkatGolongan,
				tmt: row.tmt,
				jabatan: row.jabatan,
				unitKerjaId: unitId,
				passwordHash: hash,
				wajibGantiSandi: true,
				isAdmin: row.nip === NIP_KEPALA || row.nip === NIP_PO,
				isKepalaBiro: row.nip === NIP_KEPALA,
				createdAt: now,
				updatedAt: now,
			})
			.onConflictDoNothing();
	}

	const produkId = "prd_kinerja";
	const tahapanId = "thp_catat";
	await db
		.insert(produk)
		.values({
			id: produkId,
			kode: "PRD-KINERJA",
			nama: "Pengelolaan Kinerja Pegawai ASN",
			kodeProsesL1: "1.6",
			status: "aktif",
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
	await db
		.insert(tahapan)
		.values({
			id: tahapanId,
			kode: "THP-CATAT",
			nama: "Pencatatan kinerja harian",
			produkId,
			urutan: 1,
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();
	await db
		.insert(aktivitas)
		.values({
			id: "akt_verifikasi",
			kode: "AKT-VERIF",
			nama: "Verifikasi isian kinerja",
			tahapanId,
			uraian: "Meninjau kelengkapan catatan harian.",
			normaWaktuMenit: 15,
			status: "aktif",
			createdAt: now,
			updatedAt: now,
		})
		.onConflictDoNothing();

	console.log(`Seed selesai: ${rows.length} pegawai, 10 tim, 1 produk contoh.`);
}

await main();
