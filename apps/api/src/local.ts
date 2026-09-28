import { setFallbackDb } from "@logbook/db";
import { openSqlite } from "@logbook/db/sqlite";
import { app } from "./app";

setFallbackDb(openSqlite() as Parameters<typeof setFallbackDb>[0]);

const port = Number(process.env.PORT ?? 8787);
console.log(`API Logbook di http://localhost:${port}`);

export default { port, fetch: app.fetch };
