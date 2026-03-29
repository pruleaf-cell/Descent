import { createDatabase } from "../db.js";

const dbFile = process.env.DB_FILE ?? "./apps/api/data/descent.db";
const db = createDatabase(dbFile);

db.migrate();
db.seed();
db.close();

console.log(`Seeded database at ${dbFile}`);

