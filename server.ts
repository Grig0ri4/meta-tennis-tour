import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

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
