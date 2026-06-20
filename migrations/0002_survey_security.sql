-- migrations/0002_survey_security.sql

-- Single-use codes printed on receipts/table tents. The survey requires one
-- of these to be submitted, and it is burned (used = 1) on successful submission.
CREATE TABLE IF NOT EXISTS survey_codes (
  code TEXT PRIMARY KEY,
  used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT
);

-- Anti-fraud metadata on each response
ALTER TABLE responses ADD COLUMN survey_code TEXT;
ALTER TABLE responses ADD COLUMN ip_address TEXT;
ALTER TABLE responses ADD COLUMN flag_reason TEXT;

-- Rate-limit window (in hours) for duplicate submissions by phone/IP
INSERT OR IGNORE INTO config (key, value) VALUES ('rate_limit_hours', '12');
