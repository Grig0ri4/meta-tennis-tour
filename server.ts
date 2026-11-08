import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

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
      if (body && Array.isArray(body.players) && body.players.length === 300) {
        const canonPath = path.join(__dirname, "public", "canon.json");
        let existingCanon: any = {};
        if (fs.existsSync(canonPath)) {
          try {
            existingCanon = JSON.parse(fs.readFileSync(canonPath, "utf8"));
          } catch {
            existingCanon = {};
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
        // 1) Гарантированные завершенные турниры (Галле, Queen's, Дублин, ТБШ 3, Гамбург)
        // 2) Существующие на сервере сетки
        // 3) Входящие из браузера сетки (для Олимпиады приоритет у живых матчей пользователя)
        const mergedDraws = { ...restoredBaseDraws, ...(existingCanon.draws || {}) };
        if (body.draws && typeof body.draws === "object") {
          for (const [k, d] of Object.entries(body.draws)) {
            if (Array.isArray(d) && d.length > 0) {
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

        const mergedCanon = {
          ...existingCanon,
          ...body,
          draws: mergedDraws,
          exportedAt: new Date().toISOString()
        };

        fs.writeFileSync(canonPath, JSON.stringify(mergedCanon, null, 2), "utf8");
      }
      res.json({ ok: true });
    } catch (e) {
      console.warn("canon-snapshot err:", e);
      res.status(500).json({ ok: false });
    }
  });

  app.post("/api/simulate-match", async (req, res) => {
    const {
      p1,
      p2,
      surface = "Хард",
      bestOf = 3,
      tourneyName = "Турнир ATP",
      stage = "Матч",
      h2hSummary = "0:0"
    } = req.body || {};

    if (!p1 || !p2) {
      res.status(400).json({ error: "Не переданы данные игроков (p1, p2)." });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== "MY_GEMINI_API_KEY") {
      try {
        const ai = new GoogleGenAI({
          apiKey,
          httpOptions: {
            headers: {
              "User-Agent": "aistudio-build"
            }
          }
        });

        const reqSets = bestOf === 5 ? 3 : 2;
        const prompt = `Симулируй теннисный матч турнира "${tourneyName}" (${stage}, покрытие: ${surface}, формат: best-of-${bestOf}, для победы нужно выиграть ${reqSets} сета).
Игрок 1 (верхняя строчка счета): ${p1.name} (${p1.flag}, рейтинг #${p1.rank || 50}, возраст: ${p1.age || "25 г."}).
Игрок 2 (нижняя строчка счета): ${p2.name} (${p2.flag}, рейтинг #${p2.rank || 50}, возраст: ${p2.age || "25 г."}).
История личных встреч (H2H): ${h2hSummary}.

Верни JSON с полями:
- score: строка счета по сетам строго со стороны Игрока 1 к Игроку 2 через пробел (например "6-4 6-7(5) 7-5" или "3-6 7-6(4) 4-6"). В каждом сете укажи очки проигравшего на тайбрейке в скобках, если счет 7-6 или 6-7.
- winnerId: ID победителя ("${p1.id}" или "${p2.id}").
- narrative: яркая, живая сюжетная сводка матча ровно в 1 предложение на русском языке (например: "Волевая победа после отыгрыша трёх матчболов на решающем тайбрейке!").`;

        const response = await ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            systemInstruction:
              "Ты — профессиональный спортивный аналитик и теннисный симулятор ATP. Генерируй только валидный теннисный счет, соответствующий формату матча (до 2 или 3 выигранных сетов), и краткую драматичную сводку в 1 предложение на русском языке.",
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                score: {
                  type: Type.STRING,
                  description: "Счет матча через пробел со стороны Игрока 1 (например: 6-4 6-7(4) 7-6(8))"
                },
                winnerId: {
                  type: Type.STRING,
                  description: "ID победившего игрока"
                },
                narrative: {
                  type: Type.STRING,
                  description: "Краткая сюжетная сводка матча в 1 предложение на русском языке"
                }
              },
              required: ["score", "winnerId", "narrative"]
            }
          }
        });

        const rawText = (response.text ?? "{}").trim();
        const parsed = JSON.parse(rawText);
        if (parsed && parsed.score && parsed.narrative) {
          res.json({
            score: parsed.score,
            winnerId: parsed.winnerId || p1.id,
            narrative: parsed.narrative,
            source: "gemini"
          });
          return;
        }
      } catch (err: any) {
        console.warn("Gemini simulation fallback triggered:", err?.message || err);
      }
    }

    // Детерминированный алгоритмический ИИ-расчет при отсутствии внешнего ключа в тестовом окружении
    const r1 = Number(p1.rank) || 50;
    const r2 = Number(p2.rank) || 50;
    const p1Prob = Math.min(0.82, Math.max(0.18, r2 / (r1 + r2)));
    const reqSets = bestOf === 5 ? 3 : 2;
    let w1 = 0;
    let w2 = 0;
    const sets: string[] = [];

    while (w1 < reqSets && w2 < reqSets) {
      const p1WinsSet = Math.random() < p1Prob;
      const isDecider = w1 === reqSets - 1 && w2 === reqSets - 1;
      const roll = Math.random();
      if (p1WinsSet) {
        w1++;
        if (roll < 0.25) sets.push("6-3");
        else if (roll < 0.55) sets.push("6-4");
        else if (roll < 0.75) sets.push("7-5");
        else sets.push(`7-6(${isDecider ? 8 : 5})`);
      } else {
        w2++;
        if (roll < 0.25) sets.push("3-6");
        else if (roll < 0.55) sets.push("4-6");
        else if (roll < 0.75) sets.push("5-7");
        else sets.push(`6-7(${isDecider ? 8 : 4})`);
      }
    }

    const winner = w1 > w2 ? p1 : p2;
    const loser = w1 > w2 ? p2 : p1;
    const hasTiebreak = sets.some((s) => s.includes("7-6") || s.includes("6-7"));
    const isFullDistance = sets.length === (bestOf === 5 ? 5 : 3);

    let narrative = `${winner.name} уверенно контролировал темп на задней линии (${surface.toLowerCase()}) и дожал ${loser.name} на ключевых брейк-пойнтах!`;
    if (isFullDistance && hasTiebreak) {
      narrative = `Волевая победа ${winner.name} после отыгрыша скрытых матчболов на нервном тайбрейке против ${loser.name}!`;
    } else if (isFullDistance) {
      narrative = `Драматичный затяжной триллер из ${sets.length} сетов: ${winner.name} переломил ход встречи благодаря мощной первой подаче в решающей партии!`;
    } else if (hasTiebreak) {
      narrative = `${winner.name} вырвал ключевой тайбрейк за счет агрессивного приема навылет и не оставил шансов ${loser.name}!`;
    }

    res.json({
      score: sets.join(" "),
      winnerId: winner.id,
      narrative,
      source: "ai-engine"
    });
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
