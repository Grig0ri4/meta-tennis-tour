import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OVERRIDES_FILE_PATH = path.join(__dirname, "data", "user_player_overrides.json");

// Запись разрешена только с localhost: сервер слушает 0.0.0.0, поэтому любой
// POST из внешней сети отклоняется с 403.
function isLocalRequest(req: express.Request): boolean {
  const addr = String(req.socket?.remoteAddress || "");
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

// Хранилище правок игроков: { [universeId]: { "id:p_9": {...}, "name:...": {...} } }.
// Старый плоский файл (правки всех миров вперемешку) мигрирует в { "1": {...} }.
function isFlatLegacyOverridesMap(map: Record<string, any>): boolean {
  return Object.keys(map).some((k) => k.startsWith("id:") || k.startsWith("name:"));
}

function readServerOverrides(): Record<string, any> {
  try {
    if (fs.existsSync(OVERRIDES_FILE_PATH)) {
      const raw = JSON.parse(fs.readFileSync(OVERRIDES_FILE_PATH, "utf8")) || {};
      if (raw && typeof raw === "object" && !Array.isArray(raw) && isFlatLegacyOverridesMap(raw)) {
        return { "1": raw };
      }
      return raw;
    }
  } catch {
    // ignore
  }
  return {};
}

function writeServerOverrides(map: Record<string, any>) {
  try {
    fs.writeFileSync(OVERRIDES_FILE_PATH, JSON.stringify(map || {}, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to write user_player_overrides.json:", err);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "10mb" }));

  app.get("/canon.json", (_req, res) => {
    const canonPath = path.join(__dirname, "public", "canon.json");
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.sendFile(canonPath);
  });

  app.get("/api/player-overrides", (_req, res) => {
    res.json(readServerOverrides());
  });

  app.post("/api/player-overrides", (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({ ok: false, error: "Запись разрешена только с localhost" });
      return;
    }
    const incoming = req.body && typeof req.body === "object" ? req.body : {};
    // Новый формат: { universeId, overrides: {...} }. Старый плоский формат -> вселенная "1".
    const universeId = incoming.universeId !== undefined
      ? String(incoming.universeId)
      : "1";
    const incomingOverrides = incoming.overrides && typeof incoming.overrides === "object"
      ? incoming.overrides
      : incoming;
    const current = readServerOverrides();
    const universeMap = { ...(current[universeId] || {}) };
    for (const [k, v] of Object.entries(incomingOverrides)) {
      if (v && typeof v === "object") {
        const val = v as any;
        if (val.flag && val.flag !== "?") {
          universeMap[k] = { ...(universeMap[k] || {}), ...val };
        } else if (!universeMap[k]) {
          universeMap[k] = val;
        }
      }
    }
    current[universeId] = universeMap;
    writeServerOverrides(current);
    res.json({ ok: true, overrides: current });
  });

  app.post("/api/client-diag", (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({ ok: false, error: "Запись разрешена только с localhost" });
      return;
    }
    try {
      const diagPath = path.join(__dirname, "data", "client_diag.json");
      fs.writeFileSync(diagPath, JSON.stringify(req.body || {}, null, 2), "utf8");
    } catch (e) {
      console.warn("diag write err:", e);
    }
    res.json({ ok: true });
  });

  app.get("/api/restored-draws", (_req, res) => {
    try {
      const restoredPath = path.join(__dirname, "data", "restored_halle_hamburg_draws.json");
      if (fs.existsSync(restoredPath)) {
        res.json(JSON.parse(fs.readFileSync(restoredPath, "utf8")));
        return;
      }
    } catch {}
    res.json({});
  });

  app.post("/api/canon-snapshot", (req, res) => {
    if (!isLocalRequest(req)) {
      res.status(403).json({ ok: false, error: "Запись разрешена только с localhost" });
      return;
    }
    try {
      const body = req.body;
      if (!body || !Array.isArray(body.players) || body.players.length < 250) {
        res.status(400).json({ ok: false, error: "Некорректный массив игроков (ожидается >= 250)" });
        return;
      }
      const canonPath = path.join(__dirname, "public", "canon.json");
        const masterBackupPath = path.join(__dirname, "public", "canon.backup.nov15.json");
        let existingCanon: any = {};
        if (fs.existsSync(canonPath)) {
          try {
            existingCanon = JSON.parse(fs.readFileSync(canonPath, "utf8"));
          } catch {
            existingCanon = {};
          }
        }

        let masterBackup: any = {};
        if (fs.existsSync(masterBackupPath)) {
          try {
            masterBackup = JSON.parse(fs.readFileSync(masterBackupPath, "utf8"));
          } catch {
            masterBackup = {};
          }
        }

        const restoredPath = path.join(__dirname, "data", "restored_halle_hamburg_draws.json");
        let restoredBaseDraws: Record<string, any> = {};
        if (fs.existsSync(restoredPath)) {
          try {
            restoredBaseDraws = JSON.parse(fs.readFileSync(restoredPath, "utf8")) || {};
          } catch {}
        }

        // Объединяем сетки:
        // 1) Эталонные сетки из бэкапа и restoredBaseDraws
        // 2) Существующие на сервере сетки
        // 3) Входящие из браузера сетки
        const mergedDraws = {
          ...(masterBackup.draws || {}),
          ...restoredBaseDraws,
          ...(existingCanon.draws || {})
        };
        if (body.draws && typeof body.draws === "object") {
          for (const [k, d] of Object.entries(body.draws)) {
            if (Array.isArray(d) && d.length > 0) {
              const hasWinner = d.some((r: any) => Array.isArray(r) && r.some((m: any) => m && m.winner));
              // Если входящая сетка не имеет победителей, а существующая имеет — сохраняем завершенную!
              if (!hasWinner && mergedDraws[k] && mergedDraws[k].some((r: any) => Array.isArray(r) && r.some((m: any) => m && m.winner))) {
                continue;
              }
              mergedDraws[k] = d;
            }
          }
        }

        // Если в теле запроса есть живая сетка Олимпиады — сохраняем её также в отдельный бэкап data/
        if (body.draws?.draw_olympics_2024) {
          try {
            const liveBackupPath = path.join(__dirname, "data", "live_olympics_draw.json");
            fs.writeFileSync(liveBackupPath, JSON.stringify(body.draws.draw_olympics_2024, null, 2), "utf8");
          } catch (e) {
            console.warn("live_olympics_draw backup write err:", e);
          }
        }

        // Объединяем турниры динамически без привязки к конкретному году:
        const incomingUniverse = body.universe || {};
        const incomingYear = Number(incomingUniverse.currentTourYear || body.currentTourYear || existingCanon.universe?.currentTourYear || 2025);
        const incomingDateStr = incomingUniverse.currentTourDateStr || body.currentTourDateStr || existingCanon.universe?.currentTourDateStr || `${incomingYear}-01-02`;
        const incomingTourneyId = incomingUniverse.activeTourneyId || body.activeTourneyId || existingCanon.universe?.activeTourneyId || "m_1";

        let mergedTournaments: any[];
        if (Array.isArray(body.tournaments) && body.tournaments.length >= 26) {
          mergedTournaments = body.tournaments;
        } else if (Array.isArray(existingCanon.tournaments) && existingCanon.tournaments.length >= 26) {
          mergedTournaments = existingCanon.tournaments;
        } else {
          mergedTournaments = masterBackup.tournaments || [];
        }

        // Объединяем чекпоинты:
        const masterCps = Array.isArray(masterBackup.checkpoints) ? masterBackup.checkpoints : [];
        const existingCps = Array.isArray(existingCanon.checkpoints) ? existingCanon.checkpoints : [];
        const incomingCps = Array.isArray(body.checkpoints) ? body.checkpoints : [];
        const cpMap = new Map();
        masterCps.forEach((c: any) => { if (c && c.id) cpMap.set(c.id, c); });
        existingCps.forEach((c: any) => { if (c && c.id) cpMap.set(c.id, c); });
        incomingCps.forEach((c: any) => { if (c && c.id) cpMap.set(c.id, c); });
        const mergedCheckpoints = Array.from(cpMap.values());

        const mergedUniverse = {
          id: "1",
          name: "Вселенная Автора (Канон)",
          currentTourYear: incomingYear,
          currentTourDateStr: incomingDateStr,
          activeTourneyId: incomingTourneyId
        };

        const mergedCanon = {
          ...existingCanon,
          ...body,
          universe: mergedUniverse,
          tournaments: mergedTournaments,
          draws: mergedDraws,
          checkpoints: mergedCheckpoints,
          exportedAt: new Date().toISOString()
        };

        fs.writeFileSync(canonPath, JSON.stringify(mergedCanon, null, 2), "utf8");
      res.json({ ok: true });
    } catch (e) {
      console.warn("canon-snapshot err:", e);
      res.status(500).json({ ok: false });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*all", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Meta Tennis Tour Server running on http://localhost:${PORT}`);
  });
}

startServer();
