// src/db.js — SDK 54
// Criação simples do schema (sem migrações), focado em primeiro boot do DB novo.
// Mantém fallback para Web.

import { Platform } from 'react-native';

const isWeb = Platform.OS === 'web';
let sqlite = null;
let db = null;

if (!isWeb) {
  // Import dinâmico evita quebrar no Web
  sqlite = require('expo-sqlite');
  // Use o mesmo nome que você colocou (ex.: 'kitutes_v4.db')
  db = sqlite.openDatabaseSync('kitutes_v4.db');
}

function exec(sql) {
  return db.execSync(sql);
}
function all(sql, params = []) {
  return db.getAllSync(sql, params);
}
function runSync(sql, params = []) {
  return db.runSync(sql, params);
}

export function initDb() {
  if (isWeb) {
    console.warn('[db] SQLite indisponível no Web. Rode no Android/iOS.');
    return;
  }

  // Modo WAL
  exec(`PRAGMA journal_mode = WAL;`);

  // === SCHEMA BÁSICO ===
  exec(`
    CREATE TABLE IF NOT EXISTS produtos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      preco REAL NOT NULL
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS comandas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aberta',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      closed_at TEXT
    );
  `);

  exec(`
    CREATE TABLE IF NOT EXISTS itens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comanda_id INTEGER NOT NULL,
      produto_id INTEGER,
      descricao TEXT,
      quantidade INTEGER NOT NULL DEFAULT 1,
      preco_unit REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (comanda_id) REFERENCES comandas(id),
      FOREIGN KEY (produto_id) REFERENCES produtos(id)
    );
  `);

  // Índices úteis (idempotentes)
  exec(`CREATE INDEX IF NOT EXISTS idx_itens_comanda ON itens(comanda_id);`);
  exec(`CREATE INDEX IF NOT EXISTS idx_comandas_status ON comandas(status);`);
}

function ensureNative() {
  if (isWeb) throw new Error('Banco local indisponível no Web. Use Android/iOS.');
  if (!db) throw new Error('Banco não inicializado. Chame initDb() antes.');
}

export function query(sql, params = []) {
  ensureNative();
  return all(sql, params);
}

export function run(sql, params = []) {
  ensureNative();
  return runSync(sql, params);
}

// Helpers
export function calcularTotalComanda(comandaId) {
  if (isWeb) return 0;
  const rows = query(
    `SELECT SUM(quantidade * preco_unit) AS total
       FROM itens
      WHERE comanda_id = ?`,
    [comandaId]
  );
  const total = rows?.[0]?.total ?? 0;
  return Number(total.toFixed(2));
}

export function faturamentoDoDia(iso /* 'YYYY-MM-DD' */) {
  const rows = query(`
    SELECT SUM(i.quantidade * i.preco_unit) AS total
    FROM comandas c
    JOIN itens i ON i.comanda_id = c.id
    WHERE c.status = 'fechada'
      AND substr(c.closed_at, 1, 10) = ?
  `, [iso]);
  return Number(rows?.[0]?.total ?? 0);
}
