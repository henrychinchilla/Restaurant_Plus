-- migrations/0001_schema.sql

-- Table for storing survey responses
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  food_rating INTEGER NOT NULL,
  atmosphere_rating INTEGER NOT NULL,
  waiter_rating INTEGER NOT NULL,
  waiter_name TEXT,
  quality_rating INTEGER NOT NULL,
  cost_rating INTEGER NOT NULL,
  manager_greeted INTEGER NOT NULL, -- 0 for No, 1 for Yes
  manager_name TEXT,
  parking_rating INTEGER NOT NULL,
  event_type TEXT, -- 'none', 'karaoke', etc.
  event_rating_song_selection INTEGER, -- specific to karaoke
  event_rating_wait_time INTEGER,      -- specific to karaoke/event
  event_rating_general INTEGER,        -- general rating
  comments TEXT,
  reward_sent TEXT DEFAULT 'none',     -- 'none', 'discount', 'points'
  reward_details TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_responses_created_at ON responses(created_at);
CREATE INDEX IF NOT EXISTS idx_responses_email ON responses(customer_email);

-- Table for storing admin configurations
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Seed default configurations
INSERT OR IGNORE INTO config (key, value) VALUES ('loyalty_strategy', 'discount');
INSERT OR IGNORE INTO config (key, value) VALUES ('loyalty_discount_value', '10% de descuento en tu consumo final');
INSERT OR IGNORE INTO config (key, value) VALUES ('loyalty_points_value', '100 puntos de lealtad');
INSERT OR IGNORE INTO config (key, value) VALUES ('admin_password', 'restaurantplus2026');
INSERT OR IGNORE INTO config (key, value) VALUES ('manager_email', 'henrychinchilla@gmail.com');
INSERT OR IGNORE INTO config (key, value) VALUES ('manager_phone', '+50212345678');
INSERT OR IGNORE INTO config (key, value) VALUES ('manager_notifications_enabled', 'true');
