// Обновляет публичный снимок канона автора (public/canon.json) из файла «Экспорт мира».
// Использование: npm run update-canon -- [путь к meta_tennis_save.json]
// По умолчанию берётся ../meta_tennis_save.json (рядом с папкой проекта).
import fs from 'node:fs';
import path from 'node:path';

const src = path.resolve(process.argv[2] || '../meta_tennis_save.json');
const dst = path.resolve('public/canon.json');

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
if (!Array.isArray(data.players) || data.players.length === 0 || !data.draws) {
  console.error('❌ Это не файл «Экспорт мира» (нет players/draws):', src);
  process.exit(1);
}
if (data.universe && String(data.universe.id) !== '1') {
  console.warn(`⚠️ Внимание: экспортирована вселенная «${data.universe.name}» (id=${data.universe.id}), а не Канон Автора.`);
}
fs.writeFileSync(dst, JSON.stringify(data));
const done = (data.tournaments || []).filter(t => t.completed).length;
console.log(`✅ public/canon.json обновлён: тур на ${data.universe?.currentTourDateStr}, завершено турниров: ${done}, размер ${(fs.statSync(dst).size / 1024 / 1024).toFixed(2)} МБ`);
