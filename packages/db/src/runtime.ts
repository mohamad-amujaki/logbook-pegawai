import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle } from "drizzle-orm/d1";
import { schema } from "./schema";

export type LogbookDb = ReturnType<typeof drizzle<typeof schema>>;

const penyimpanan = new AsyncLocalStorage<LogbookDb>();
let cadangan: LogbookDb | undefined;

export function createD1Db(d1: ConstructorParameters<typeof drizzle>[0]): LogbookDb {
	return drizzle(d1, { schema });
}

export function setFallbackDb(database: LogbookDb) {
	cadangan = database;
}

export function runWithDb<T>(database: LogbookDb, fn: () => T): T {
	return penyimpanan.run(database, fn);
}

function dbAktif(): LogbookDb {
	const dariPermintaan = penyimpanan.getStore();
	if (dariPermintaan) return dariPermintaan;
	if (cadangan) return cadangan;
	throw new Error("Basis data belum diikat ke permintaan.");
}

export const db = new Proxy({} as LogbookDb, {
	get(_target, prop, _receiver) {
		const nyata = dbAktif();
		const nilai = Reflect.get(nyata, prop, nyata);
		return typeof nilai === "function" ? nilai.bind(nyata) : nilai;
	},
});
