import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { hashPassword } from "./password";

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
};

function id(prefix: string, raw: string) {
	return `${prefix}_${raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
}

function sqlStr(nilai: string | null | undefined): string {
	if (nilai == null) return "NULL";
	return `'${nilai.replaceAll("'", "''")}'`;
}

async function main() {
	const jsonPath = resolve(import.meta.dir, "../../../data/duk-pegawai.json");
	const keluar = resolve(import.meta.dir, "../../../data/seed-d1.sql");
	const rows = JSON.parse(readFileSync(jsonPath, "utf8")) as DukRow[];
	const now = new Date().toISOString();
	const eselonId = "unit_setjen";
	const unitId = "unit_osdm";
	const baris: string[] = ["PRAGMA foreign_keys = ON;"];

	baris.push(
		`INSERT OR IGNORE INTO unit_kerja (id, kode, nama, induk_id, status, created_at, updated_at) VALUES (${sqlStr(eselonId)}, 'SETJEN', 'Sekretariat Jenderal', NULL, 'aktif', ${sqlStr(now)}, ${sqlStr(now)});`,
	);
	baris.push(
		`INSERT OR IGNORE INTO unit_kerja (id, kode, nama, induk_id, status, created_at, updated_at) VALUES (${sqlStr(unitId)}, 'OSDM', 'Biro Organisasi dan Sumber Daya Manusia', ${sqlStr(eselonId)}, 'aktif', ${sqlStr(now)}, ${sqlStr(now)});`,
	);

	for (const [i, [kode, nama]] of TIM.entries()) {
		baris.push(
			`INSERT OR IGNORE INTO tim_kerja (id, kode, nama, unit_kerja_id, status, urutan, created_at, updated_at) VALUES (${sqlStr(id("tim", kode))}, ${sqlStr(kode)}, ${sqlStr(nama)}, ${sqlStr(unitId)}, 'aktif', ${i + 1}, ${sqlStr(now)}, ${sqlStr(now)});`,
		);
	}

	for (const row of rows) {
		const hash = await hashPassword(row.nip);
		const admin = row.nip === NIP_KEPALA || row.nip === NIP_PO ? 1 : 0;
		const kepala = row.nip === NIP_KEPALA ? 1 : 0;
		baris.push(
			`INSERT OR IGNORE INTO pegawai (id, nip, nama_lengkap, pangkat_golongan, tmt, jabatan, unit_kerja_id, password_hash, wajib_ganti_sandi, is_admin, is_kepala_biro, created_at, updated_at) VALUES (${sqlStr(id("pg", row.nip))}, ${sqlStr(row.nip)}, ${sqlStr(row.namaLengkap)}, ${sqlStr(row.pangkatGolongan)}, ${sqlStr(row.tmt)}, ${sqlStr(row.jabatan)}, ${sqlStr(unitId)}, ${sqlStr(hash)}, 1, ${admin}, ${kepala}, ${sqlStr(now)}, ${sqlStr(now)});`,
		);
	}

	baris.push(
		`INSERT OR IGNORE INTO produk (id, kode, nama, kode_proses_l1, status, created_at, updated_at) VALUES ('prd_kinerja', 'PRD-KINERJA', 'Pengelolaan Kinerja Pegawai ASN', '1.6', 'aktif', ${sqlStr(now)}, ${sqlStr(now)});`,
	);
	baris.push(
		`INSERT OR IGNORE INTO tahapan (id, kode, nama, produk_id, urutan, created_at, updated_at) VALUES ('thp_catat', 'THP-CATAT', 'Pencatatan kinerja harian', 'prd_kinerja', 1, ${sqlStr(now)}, ${sqlStr(now)});`,
	);
	baris.push(
		`INSERT OR IGNORE INTO aktivitas (id, kode, nama, tahapan_id, uraian, norma_waktu_menit, status, created_at, updated_at) VALUES ('akt_verifikasi', 'AKT-VERIF', 'Verifikasi isian kinerja', 'thp_catat', 'Meninjau kelengkapan catatan harian.', 15, 'aktif', ${sqlStr(now)}, ${sqlStr(now)});`,
	);

	writeFileSync(keluar, `${baris.join("\n")}\n`);
	console.log(`SQL seed D1: ${keluar} (${rows.length} pegawai).`);
}

await main();
