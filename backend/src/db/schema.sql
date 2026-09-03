CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  cycle_start_day INTEGER NOT NULL DEFAULT 1,
  monthly_budget NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'MXN')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD', 'COP', 'MXN'));

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (type IN ('INCOME', 'EXPENSE')),
  monthly_budget NUMERIC(12, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE categories ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'EXPENSE' CHECK (type IN ('INCOME', 'EXPENSE'));
ALTER TABLE categories ADD COLUMN IF NOT EXISTS monthly_budget NUMERIC(12, 2);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES categories (id),
  type TEXT NOT NULL CHECK (type IN ('INCOME', 'EXPENSE')),
  amount NUMERIC(12, 2) NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);
