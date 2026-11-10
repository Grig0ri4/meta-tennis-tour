import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OVERRIDES_FILE_PATH = path.join(__dirname, "data", "user_player_overrides.json");

function readServerOverrides(): Record<string, any> {
  try {
    if (fs.existsSync(OVERRIDES_FILE_PATH)) {
      return JSON.parse(fs.readFileSync(OVERRIDES_FILE_PATH, "utf8")) || {};
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
    const incoming = req.body && typeof req.body === "object" ? req.body : {};
    const current = readServerOverrides();
    for (const [k, v] of Object.entries(incoming)) {
      if (v && typeof v === "object") {
        const val = v as any;
        if (val.flag && val.flag !== "?") {
          current[k] = { ...(current[k] || {}), ...val };
        } else if (!current[k]) {
          current[k] = val;
        }
      }
    }
    writeServerOverrides(current);
    res.json({ ok: true, overrides: current });
  });

  app.post("/api/client-diag", (req, res) => {
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

        // Объединяем турниры:
        const incomingYear = Number(body.universe?.currentTourYear || body.currentTourYear || existingCanon.universe?.currentTourYear || 2025);
        let mergedTournaments: any[];
        if (incomingYear >= 2025) {
          mergedTournaments = Array.isArray(body.tournaments) && body.tournaments.length >= 26
            ? body.tournaments
            : (Array.isArray(existingCanon.tournaments) ? existingCanon.tournaments : (masterBackup.tournaments || []));
        } else {
          // 2024: завершенные турниры НИКОГДА не откатываются назад в completed: false!
          const baseTourneys = Array.isArray(masterBackup.tournaments) && masterBackup.tournaments.length >= 26
            ? masterBackup.tournaments
            : (Array.isArray(existingCanon.tournaments) ? existingCanon.tournaments : []);
          const incomingTourneys = Array.isArray(body.tournaments) ? body.tournaments : [];

          mergedTournaments = baseTourneys.map((ext: any) => {
            const inc = incomingTourneys.find((t: any) => t && t.id === ext.id);
            if (ext.completed) {
              return { ...(inc || {}), ...ext, completed: true };
            }
            return inc || ext;
          });
        }

        // Объединяем чекпоинты (включая ручной чекпоинт от 15 ноября):
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
          currentTourDateStr: body.universe?.currentTourDateStr || body.currentTourDateStr || existingCanon.universe?.currentTourDateStr || masterBackup.universe?.currentTourDateStr || (incomingYear >= 2025 ? "2025-01-02" : "2024-11-15"),
          activeTourneyId: body.universe?.activeTourneyId || body.activeTourneyId || existingCanon.universe?.activeTourneyId || masterBackup.universe?.activeTourneyId || (incomingYear >= 2025 ? "m_1" : "finals")
        };

        const mergedCanon = {
          ...existingCanon,
          ...body,
          universe: mergedUniverse,
          tournaments: mergedTournaments.length >= 26 ? mergedTournaments : baseTourneys,
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
