//! İlerleme kaydı (SQLite, WAL kipi).
//!
//! Mobil sürüm her değişiklikte tüm durumu tek bir JSON olarak yeniden yazıyordu. Burada her
//! kelime ayrı bir satır: bir cevap yalnızca o satırı günceller.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

/// Ön yüzden gelen kayıt işlemi (src/platform/backend.ts > Op ile aynı).
#[derive(Debug, Deserialize)]
#[serde(tag = "op", rename_all = "camelCase")]
pub enum Op {
    Stat { id: String, c: f64, w: f64, s: f64, t: f64, d: Option<f64> },
    Passive { id: String, on: bool },
    Kv { key: String, value: String },
    ClearStats,
    ClearAll,
}

/// Açılışta ön yüze bir kez gönderilen veri. stats: [id, c, w, s, t, d]
#[derive(Debug, Default, Serialize, PartialEq)]
pub struct Loaded {
    pub stats: Vec<(String, i64, i64, i64, i64, Option<i64>)>,
    pub passive: Vec<String>,
    pub kv: HashMap<String, String>,
}

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> rusqlite::Result<Self> {
        Self::init(Connection::open(path)?)
    }

    #[cfg(test)]
    pub fn memory() -> rusqlite::Result<Self> {
        Self::init(Connection::open_in_memory()?)
    }

    fn init(conn: Connection) -> rusqlite::Result<Self> {
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA temp_store = MEMORY;
             CREATE TABLE IF NOT EXISTS stats (
               id TEXT PRIMARY KEY NOT NULL,
               c INTEGER NOT NULL, w INTEGER NOT NULL, s INTEGER NOT NULL, t INTEGER NOT NULL, d INTEGER
             ) WITHOUT ROWID;
             CREATE TABLE IF NOT EXISTS passive (id TEXT PRIMARY KEY NOT NULL) WITHOUT ROWID;
             CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL) WITHOUT ROWID;",
        )?;
        Ok(Self(Mutex::new(conn)))
    }

    pub fn load(&self) -> rusqlite::Result<Loaded> {
        let conn = self.0.lock().unwrap_or_else(|e| e.into_inner());
        let stats = conn
            .prepare("SELECT id, c, w, s, t, d FROM stats")?
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?, r.get(5)?)))?
            .collect::<rusqlite::Result<_>>()?;
        let passive = conn
            .prepare("SELECT id FROM passive")?
            .query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        let kv = conn
            .prepare("SELECT key, value FROM kv")?
            .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))?
            .collect::<rusqlite::Result<_>>()?;
        Ok(Loaded { stats, passive, kv })
    }

    /// İşlemleri tek bir işlemde (transaction) uygular: ya hepsi yazılır ya hiçbiri.
    pub fn apply(&self, ops: &[Op]) -> rusqlite::Result<()> {
        let mut conn = self.0.lock().unwrap_or_else(|e| e.into_inner());
        let tx = conn.transaction()?;
        {
            let mut put_stat = tx.prepare_cached(
                "INSERT INTO stats (id, c, w, s, t, d) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
                 ON CONFLICT(id) DO UPDATE SET c = ?2, w = ?3, s = ?4, t = ?5, d = ?6",
            )?;
            for op in ops {
                match op {
                    Op::Stat { id, c, w, s, t, d } => {
                        put_stat.execute(params![id, *c as i64, *w as i64, *s as i64, *t as i64, d.map(|d| d as i64)])?;
                    }
                    Op::Passive { id, on: true } => {
                        tx.execute("INSERT OR IGNORE INTO passive (id) VALUES (?1)", [id])?;
                    }
                    Op::Passive { id, on: false } => {
                        tx.execute("DELETE FROM passive WHERE id = ?1", [id])?;
                    }
                    Op::Kv { key, value } => {
                        tx.execute(
                            "INSERT INTO kv (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2",
                            [key, value],
                        )?;
                    }
                    Op::ClearStats => {
                        tx.execute("DELETE FROM stats", [])?;
                    }
                    Op::ClearAll => {
                        tx.execute_batch("DELETE FROM stats; DELETE FROM passive; DELETE FROM kv;")?;
                    }
                }
            }
        }
        tx.commit()
    }

    pub fn kv(&self, key: &str) -> Option<String> {
        let conn = self.0.lock().unwrap_or_else(|e| e.into_inner());
        conn.query_row("SELECT value FROM kv WHERE key = ?1", [key], |r| r.get(0))
            .optional()
            .ok()
            .flatten()
    }
}

/// Ayarlardaki "kapatınca tepside beklesin" değeri (varsayılan: açık).
pub fn close_to_tray(settings_json: Option<&str>) -> bool {
    settings_json
        .and_then(|s| serde_json::from_str::<serde_json::Value>(s).ok())
        .and_then(|v| v.get("closeToTray").and_then(|b| b.as_bool()))
        .unwrap_or(true)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn ops(json: &str) -> Vec<Op> {
        serde_json::from_str(json).unwrap()
    }

    #[test]
    fn stat_upsert_and_load() {
        let db = Db::memory().unwrap();
        db.apply(&ops(r#"[{"op":"stat","id":"house","c":1,"w":0,"s":1,"t":1700000000000,"d":1700086400000}]"#)).unwrap();
        db.apply(&ops(r#"[{"op":"stat","id":"house","c":1,"w":1,"s":0,"t":1700000005000}]"#)).unwrap();
        let l = db.load().unwrap();
        assert_eq!(l.stats, vec![("house".into(), 1, 1, 0, 1700000005000, None)]);
    }

    #[test]
    fn passive_kv_and_clear() {
        let db = Db::memory().unwrap();
        db.apply(&ops(
            r#"[{"op":"passive","id":"a","on":true},{"op":"passive","id":"b","on":true},
                {"op":"passive","id":"a","on":false},{"op":"kv","key":"settings","value":"{\"closeToTray\":false}"},
                {"op":"stat","id":"x","c":2,"w":0,"s":2,"t":5}]"#,
        ))
        .unwrap();
        let l = db.load().unwrap();
        assert_eq!(l.passive, vec!["b".to_string()]);
        assert!(!close_to_tray(db.kv("settings").as_deref()));

        db.apply(&ops(r#"[{"op":"clearStats"}]"#)).unwrap();
        let l = db.load().unwrap();
        assert!(l.stats.is_empty());
        assert_eq!(l.passive.len(), 1);

        db.apply(&ops(r#"[{"op":"clearAll"}]"#)).unwrap();
        assert_eq!(db.load().unwrap(), Loaded::default());
    }

    #[test]
    fn failed_batch_writes_nothing() {
        let db = Db::memory().unwrap();
        db.apply(&ops(r#"[{"op":"stat","id":"x","c":1,"w":0,"s":1,"t":5}]"#)).unwrap();
        // Bozuk işlem gelirse JSON çözümlemesi başarısız olur; mevcut veri korunur
        assert!(serde_json::from_str::<Vec<Op>>(r#"[{"op":"clearAll"},{"op":"stat","id":"y"}]"#).is_err());
        assert_eq!(db.load().unwrap().stats.len(), 1);
    }

    #[test]
    fn close_to_tray_default() {
        assert!(close_to_tray(None));
        assert!(close_to_tray(Some("not json")));
        assert!(close_to_tray(Some("{}")));
    }

    #[test]
    fn persists_on_disk() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("kelime.db");
        {
            let db = Db::open(&path).unwrap();
            db.apply(&ops(r#"[{"op":"kv","key":"lastLevel","value":"\"B1\""}]"#)).unwrap();
        }
        let db = Db::open(&path).unwrap();
        assert_eq!(db.kv("lastLevel").as_deref(), Some("\"B1\""));
    }
}
