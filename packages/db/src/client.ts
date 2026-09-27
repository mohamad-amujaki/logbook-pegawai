import { resolve } from "node:path";
import { Database } from "bun:sqlite";
import { drizzle } from "drizzle-orm/bun-sqlite";
import { schema } from "./schema";

const defaultFile = resolve(import.meta.dir, "../../../local.db");
const file = (process.env.DATABASE_URL ?? `file:${defaultFile}`).replace(/^file:/, "");

export function openSqlite(path = file) {
	const sqlite = new Database(path, { create: true });
	sqlite.exec("PRAGMA journal_mode = WAL;");
	sqlite.exec("PRAGMA foreign_keys = ON;");
	return drizzle(sqlite, { schema });
}

export const db = openSqlite();
export type DatabaseClient = ReturnType<typeof openSqlite>;
