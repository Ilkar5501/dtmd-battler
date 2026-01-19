// db.js (ESM)
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("koyeb")
    ? { rejectUnauthorized: false }
    : false,
});

export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cards (
      user_id TEXT NOT NULL,
      inv_id INT NOT NULL,
      character_key TEXT NOT NULL,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, inv_id)
    );
  `);
}

export async function getUserInvIds(userId) {
  const res = await pool.query(
    `SELECT inv_id FROM cards WHERE user_id = $1 ORDER BY inv_id ASC`,
    [String(userId)]
  );
  return res.rows.map((r) => r.inv_id);
}

export async function addCard(userId, invId, characterKey) {
  await pool.query(
    `INSERT INTO cards (user_id, inv_id, character_key) VALUES ($1, $2, $3)`,
    [String(userId), invId, characterKey]
  );
}

export async function getCard(userId, invId) {
  const res = await pool.query(
    `SELECT * FROM cards WHERE user_id = $1 AND inv_id = $2 LIMIT 1`,
    [String(userId), invId]
  );
  return res.rows[0] || null;
}

export async function getInventory(userId) {
  const res = await pool.query(
    `SELECT inv_id, character_key, claimed_at FROM cards WHERE user_id = $1 ORDER BY inv_id ASC`,
    [String(userId)]
  );
  return res.rows;
}
