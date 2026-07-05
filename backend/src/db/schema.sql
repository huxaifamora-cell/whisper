-- Whisper database schema (Postgres)

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  pairing_code  TEXT UNIQUE NOT NULL,      -- used to link Telegram + Android app to this account
  telegram_chat_id TEXT,                   -- filled in once user links via /link <code> on the bot
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fcm_token   TEXT NOT NULL,
  platform    TEXT NOT NULL DEFAULT 'android',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, fcm_token)
);

CREATE TABLE IF NOT EXISTS rules (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,             -- e.g. R_75, R_100, 1HZ100V
  timeframe     TEXT NOT NULL,             -- informational label chosen by user, e.g. M5, M15, H1
  target_price  NUMERIC NOT NULL,
  direction     TEXT NOT NULL CHECK (direction IN ('buy','sell')), -- buy = alert when price crosses UP through target, sell = crosses DOWN
  sound         TEXT NOT NULL DEFAULT 'default',
  status        TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','triggered','disabled')),
  last_price    NUMERIC,                    -- last seen tick price, used to detect a crossing
  triggered_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS alert_history (
  id          SERIAL PRIMARY KEY,
  rule_id     INTEGER NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  price       NUMERIC NOT NULL,
  direction   TEXT NOT NULL,
  dispatched_telegram BOOLEAN NOT NULL DEFAULT false,
  dispatched_fcm      BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rules_symbol_status ON rules(symbol, status);
