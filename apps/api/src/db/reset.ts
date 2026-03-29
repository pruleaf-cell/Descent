import { createDatabase, deleteDatabaseFile } from "../db.js";

const dbFile = process.env.DB_FILE ?? "./apps/api/data/descent.db";

deleteDatabaseFile(dbFile);

const db = createDatabase(dbFile);
db.migrate();
db.seed();
db.close();

console.log(`Reset database at ${dbFile}`);

