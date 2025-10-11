import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define database file path
const dataDir = path.join(__dirname, "../../data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Connect to SQLite database
const dbFile = path.join(dataDir, "database.db");
const db = new Database(dbFile);

// Create the counter table if it doesn't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS counter (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    value INTEGER NOT NULL DEFAULT 0
  );

  -- Insert a default counter value if none exists
  INSERT OR IGNORE INTO counter (id, value) VALUES (1, 0);
`);

// Counter operations
export const counterOperations = {
  getValue: (): { value: number } | null => {
    try {
      const row = db.prepare("SELECT value FROM counter WHERE id = 1").get() as { value: number } | undefined;
      return row ? { value: row.value } : { value: 0 };
    } catch (error) {
      console.error('Error getting counter value:', error);
      return { value: 0 };
    }
  },

  setValue: (value: number): { value: number } => {
    try {
      db.prepare("UPDATE counter SET value = ? WHERE id = 1").run(value);
      return { value };
    } catch (error) {
      console.error('Error setting counter value:', error);
      return { value: -1 };
    }
  }
};

// Export the database instance for potential direct access
export default db;
