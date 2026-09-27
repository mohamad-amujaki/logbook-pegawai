import { db, notifikasi } from "@logbook/db";
import { buatId } from "./id";

export async function kirimNotifikasi(input: {
	pegawaiId: string;
	judul: string;
	isi: string;
	tautan?: string;
}) {
	await db.insert(notifikasi).values({
		id: buatId("ntf"),
		pegawaiId: input.pegawaiId,
		judul: input.judul,
		isi: input.isi,
		tautan: input.tautan,
		dibaca: false,
	});
}
