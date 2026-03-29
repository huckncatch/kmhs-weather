import Database from 'better-sqlite3'
import fs from 'fs'
import path from 'path'

const DB_PATH = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'weather.db')

if (DB_PATH !== ':memory:') {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
}

const db = new Database(DB_PATH)

// WAL mode: better read concurrency, faster writes
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS cocorahs_observations (
    id TEXT PRIMARY KEY,
    date TEXT UNIQUE NOT NULL,
    rainfall REAL NOT NULL,
    snowfall REAL,
    snowfall_new_depth REAL,
    snowfall_water_content REAL,
    snowfall_slr REAL,
    snowpack_total_depth REAL,
    snowpack_water_content REAL,
    snowpack_density REAL,
    obs_time TEXT,
    station_number TEXT,
    station_name TEXT,
    state TEXT,
    county TEXT,
    notes TEXT,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ambient_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT UNIQUE NOT NULL,
    date TEXT NOT NULL,
    temp_f REAL,
    feels_like REAL,
    temp_indoor_f REAL,
    humidity REAL,
    humidity_indoor REAL,
    wind_speed_mph REAL,
    wind_dir INTEGER,
    wind_gust_mph REAL,
    pressure_relative REAL,
    pressure_absolute REAL,
    daily_rain_in REAL,
    uv REAL,
    solar_radiation REAL,
    battery_ok INTEGER
  );

  CREATE INDEX IF NOT EXISTS idx_ambient_readings_date ON ambient_readings(date);
`)

export default db
