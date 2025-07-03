"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.counterOperations = void 0;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Define database file path
const dataDir = path_1.default.join(__dirname, "../../data");
if (!fs_1.default.existsSync(dataDir)) {
    fs_1.default.mkdirSync(dataDir, { recursive: true });
}
// Connect to SQLite database
const dbFile = path_1.default.join(dataDir, "database.db");
const db = new better_sqlite3_1.default(dbFile);
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
exports.counterOperations = {
    getValue: () => {
        try {
            const row = db.prepare("SELECT value FROM counter WHERE id = 1").get();
            return row ? { value: row.value } : { value: 0 };
        }
        catch (error) {
            console.error('Error getting counter value:', error);
            return { value: 0 };
        }
    },
    setValue: (value) => {
        try {
            db.prepare("UPDATE counter SET value = ? WHERE id = 1").run(value);
            return { value };
        }
        catch (error) {
            console.error('Error setting counter value:', error);
            return { value: -1 };
        }
    }
};
// Export the database instance for potential direct access
exports.default = db;
