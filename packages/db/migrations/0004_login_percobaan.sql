PRAGMA foreign_keys = ON;

CREATE TABLE login_percobaan (
  id TEXT PRIMARY KEY,
  kunci TEXT NOT NULL,
  terjadi_pada TEXT NOT NULL
);

CREATE INDEX login_percobaan_kunci_idx ON login_percobaan(kunci, terjadi_pada);
