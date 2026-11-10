const fs = require('fs');
const path = require('path');

function buildFallbackFinalPressColumn({
  tourneyName = 'Турнир ATP',
  tourneyType = 'Мастерс',
  surface = 'Хард',
  year = 2024,
  winner,
  runnerUp,
  score = '6-4 6-4'
}) {
  const formatPlayerWithFlag = (p, fallbackLabel) => {
    if (!p || !p.name) return fallbackLabel;
    return p.flag && p.flag !== '?' ? `${p.name} (${p.flag})` : p.name;
  };

  const wName = formatPlayerWithFlag(winner, 'Чемпион тура');
  const rName = formatPlayerWithFlag(runnerUp, 'Финалист');
  const wShort = winner?.name || 'Чемпион';
  const rShort = runnerUp?.name || 'соперник';

  const hasTiebreak = String(score).includes('7-6') || String(score).includes('6-7');

  let headline = '';
  let article = '';

  if (tourneyType === 'ТБШ') {
    headline = hasTiebreak
      ? `Триумф воли на мэйджоре: ${wShort} в тяжелейшей драме вырывает кубок ${tourneyName} у ${rShort}!`
      : `Абсолютное величие: ${wShort} разгромил соперника и стал королем ${tourneyName} ${year}!`;
    article = `В грандиозном финале турнира Большого Шлема «${tourneyName}» ${year} года сошлись ${wName} и ${rName}. Покрытие «${surface}» стало ареной бескомпромиссной тактической битвы лучших ракеток планеты. ${wShort} продемонстрировал запредельную концентрацию в решающие моменты матча, надежно отподавал на брейк-поинтах и оформил итоговую победу со счетом ${score}. Этот исторический титул навсегда войдет в анналы мирового тенниса и открывает ${wShort} прямую дорогу к вершине рейтинга тура.`;
  } else if (tourneyType === 'Итоговый') {
    headline = `Коронация короля сезона: ${wShort} завоевал итоговый титул года в схватке с ${rShort}!`;
    article = `В решающем матче Итогового чемпионата года встречались ${wName} и ${rName}. В битве сильнейших теннисистов планеты на быстром корте (${surface}) ${wShort} оказался стабильнее и тактически гибче оппонента, взяв верх со счетом ${score}. Заслуженный трофей венчает триумфальный сезон для ${wShort} и закрепляет за ним статус доминатора мужского тура.`;
  } else if (tourneyType === 'Олимпиада') {
    headline = `Золотой триумф на века: ${wShort} приносит олимпийское золото в историческом финале против ${rShort}!`;
    article = `На кортах олимпийского теннисного турнира ${year} года ${wName} вписал свое имя в олимпийскую летопись, одолев ${rName} в золотом финале со счетом ${score}. В каждом розыгрыше чувствовалось колоссальное напряжение за честь флага, но ${wShort} показал феноменальную стойкость в ключевых геймах и завоевал высшую спортивную награду — олимпийское золото.`;
  } else {
    headline = hasTiebreak
      ? `Стальные нервы в финале ${tourneyName} ${year}: ${wShort} сломил ${rShort} на решающем тайбрейке!`
      : `Мастер-класс в решающем матче: ${wShort} уверенно забирает титул ${tourneyName} у ${rShort}!`;
    article = `В главном финале престижного турнира категории «${tourneyType}» «${tourneyName}» сезона ${year} года ${wName} переиграл ${rName} с итоговым счетом ${score}. На быстром покрытии «${surface}» чемпион захватил контроль над центром корта за счет агрессивного приема и глубоких переводов по линии. Завоеванный титул приносит ${wShort} весомую прибавку очков в 52-недельный рейтинг ATP и золотыми буквами вписывает его имя в архив Зала Славы Meta Tennis Tour.`;
  }

  return {
    headline,
    article,
    source: 'local-press'
  };
}

const targetFiles = [
  'data/canon_nov15_master.json',
  'public/canon.json',
  'public/canon.backup.nov15.json'
];

const report = [];

targetFiles.forEach(relPath => {
  const absPath = path.resolve(relPath);
  if (!fs.existsSync(absPath)) {
    console.error(`File not found: ${absPath}`);
    return;
  }

  let raw = fs.readFileSync(absPath, 'utf8');

  // 1. Исправление опечатки «мёртвого» подачи -> пушечной первой подачи
  const typoMatches = raw.match(/«мёртвого» подачи/g) || [];
  const typoCount = typoMatches.length;
  if (typoCount > 0) {
    raw = raw.replace(/«мёртвого» подачи/g, 'пушечной первой подачи');
  }

  const data = JSON.parse(raw);
  const draws = data.draws || {};

  let tourneysData2024Updated = 0;
  let tourneysData2023Updated = 0;
  let rootTourneysUpdated = 0;
  const detailedChanges = [];

  // 2. Синхронизация tournamentsData для 2023 и 2024 годов
  ['2023', '2024'].forEach(yearStr => {
    if (!data.seasonsHistory) data.seasonsHistory = {};
    if (!data.seasonsHistory[yearStr]) data.seasonsHistory[yearStr] = { tournamentsData: [] };
    if (!Array.isArray(data.seasonsHistory[yearStr].tournamentsData)) {
      data.seasonsHistory[yearStr].tournamentsData = [];
    }

    const tDataList = data.seasonsHistory[yearStr].tournamentsData;

    // Ищем все сетки для этого года
    for (const [drawKey, drawRounds] of Object.entries(draws)) {
      if (!drawKey.endsWith(`_${yearStr}`)) continue;
      const tId = drawKey.replace(/^draw_/, '').replace(new RegExp(`_${yearStr}$`), '');
      if (!Array.isArray(drawRounds) || drawRounds.length === 0) continue;

      const finalMatch = drawRounds[drawRounds.length - 1]?.[0];
      if (!finalMatch || !finalMatch.winner || !finalMatch.p1 || !finalMatch.p2) continue;

      const w = finalMatch.winner;
      const ru = String(finalMatch.p1.id) === String(w.id) ? finalMatch.p2 : finalMatch.p1;
      const scoreStr = Array.isArray(finalMatch.score) && finalMatch.score.length > 0
        ? finalMatch.score.join(' ')
        : (typeof finalMatch.score === 'string' && finalMatch.score ? finalMatch.score : '6-4 6-4');
      const bronze = tId === 'olympics' ? (drawRounds[drawRounds.length - 1]?.[1]?.winner || null) : null;

      let histEntry = tDataList.find(t => t && t.id === tId);
      const isMajor = ['ТБШ', 'Мастерс', 'Итоговый', 'Олимпиада'].includes(histEntry?.type || '');

      const compactWinner = {
        id: w.id,
        name: w.name,
        flag: w.flag || '',
        rank: w.rank || 1,
        birthDate: w.birthDate || ''
      };
      const compactRunnerUp = {
        id: ru.id,
        name: ru.name,
        flag: ru.flag || '',
        rank: ru.rank || 2,
        birthDate: ru.birthDate || ''
      };
      const compactBronze = bronze ? {
        id: bronze.id,
        name: bronze.name,
        flag: bronze.flag || '',
        rank: bronze.rank || 3
      } : null;

      if (!histEntry) {
        histEntry = {
          id: tId,
          name: tId,
          type: 'Турнир',
          surface: 'Хард',
          winner: compactWinner,
          runnerUp: compactRunnerUp,
          bronze: compactBronze,
          score: scoreStr,
          pressColumn: null
        };
        tDataList.push(histEntry);
        detailedChanges.push(`[${yearStr}] Добавлен отсутствующий турнир ${tId} в tournamentsData (Победитель: ${w.name})`);
        if (yearStr === '2024') tourneysData2024Updated++;
        else tourneysData2023Updated++;
      } else {
        const winnerChanged = String(histEntry.winner?.id) !== String(w.id) || histEntry.winner?.name !== w.name;
        const ruChanged = String(histEntry.runnerUp?.id) !== String(ru.id) || histEntry.runnerUp?.name !== ru.name;
        const scoreChanged = histEntry.score !== scoreStr;
        const bronzeChanged = tId === 'olympics' && String(histEntry.bronze?.id) !== String(bronze?.id);

        let pressMismatched = false;
        if (isMajor && histEntry.pressColumn) {
          const text = (histEntry.pressColumn.headline || '') + ' ' + (histEntry.pressColumn.article || '');
          if (w.name && !text.includes(w.name)) {
            pressMismatched = true;
          }
        }

        if (winnerChanged || ruChanged || scoreChanged || bronzeChanged || pressMismatched) {
          detailedChanges.push(
            `[${yearStr}] Турнир #${histEntry.id} (${histEntry.name}): ` +
            `Winner: ${histEntry.winner?.name} (${histEntry.winner?.id}) -> ${w.name} (${w.id}) | ` +
            `RunnerUp: ${histEntry.runnerUp?.name} (${histEntry.runnerUp?.id}) -> ${ru.name} (${ru.id}) | ` +
            `Score: ${histEntry.score} -> ${scoreStr}`
          );

          histEntry.winner = compactWinner;
          histEntry.runnerUp = compactRunnerUp;
          histEntry.score = scoreStr;
          histEntry.bronze = compactBronze;

          if (isMajor && (winnerChanged || ruChanged || pressMismatched || !histEntry.pressColumn)) {
            histEntry.pressColumn = buildFallbackFinalPressColumn({
              tourneyName: histEntry.name,
              tourneyType: histEntry.type,
              surface: histEntry.surface,
              year: Number(yearStr),
              winner: compactWinner,
              runnerUp: compactRunnerUp,
              score: scoreStr
            });
          }

          if (yearStr === '2024') tourneysData2024Updated++;
          else tourneysData2023Updated++;
        }
      }
    }
  });

  // 3. Синхронизация корневого массива tournaments с результатами 2024
  if (Array.isArray(data.tournaments)) {
    data.tournaments.forEach(t => {
      const drawKey2024 = `draw_${t.id}_2024`;
      const dr = draws[drawKey2024];
      if (Array.isArray(dr) && dr.length > 0) {
        const fm = dr[dr.length - 1]?.[0];
        if (fm && fm.winner && fm.p1 && fm.p2) {
          const w = fm.winner;
          const ru = String(fm.p1.id) === String(w.id) ? fm.p2 : fm.p1;
          const scoreStr = Array.isArray(fm.score) && fm.score.length > 0
            ? fm.score.join(' ')
            : (typeof fm.score === 'string' && fm.score ? fm.score : '6-4 6-4');
          const bronze = t.id === 'olympics' ? (dr[dr.length - 1]?.[1]?.winner || null) : null;

          const changed = String(t.lastWinner?.id) !== String(w.id) ||
                          t.lastWinner?.name !== w.name ||
                          String(t.lastRunnerUp?.id) !== String(ru.id) ||
                          t.lastScore !== scoreStr;

          if (changed) {
            t.lastWinner = {
              id: w.id,
              name: w.name,
              flag: w.flag || '',
              rank: w.rank || 1,
              birthDate: w.birthDate || ''
            };
            t.lastRunnerUp = {
              id: ru.id,
              name: ru.name,
              flag: ru.flag || '',
              rank: ru.rank || 2,
              birthDate: ru.birthDate || ''
            };
            t.lastScore = scoreStr;
            if (t.id === 'olympics') {
              t.lastBronze = bronze ? {
                id: bronze.id,
                name: bronze.name,
                flag: bronze.flag || '',
                rank: bronze.rank || 3
              } : null;
            }
            rootTourneysUpdated++;
          }
        }
      }
    });
  }

  // Запись обратно на диск
  fs.writeFileSync(absPath, JSON.stringify(data, null, 2), 'utf8');

  report.push({
    file: relPath,
    typoCount,
    tourneysData2024Updated,
    tourneysData2023Updated,
    rootTourneysUpdated,
    detailedChanges
  });
});

console.log('\n=================== SANITATION REPORT ===================');
report.forEach(r => {
  console.log(`\n[FILE]: ${r.file}`);
  console.log(`   - Typo replacements: ${r.typoCount}`);
  console.log(`   - 2024 tournamentsData corrections: ${r.tourneysData2024Updated}`);
  console.log(`   - 2023 tournamentsData corrections: ${r.tourneysData2023Updated}`);
  console.log(`   - Root tournaments array updates: ${r.rootTourneysUpdated}`);
  if (r.detailedChanges.length > 0) {
    console.log('   - Details:');
    r.detailedChanges.forEach(c => console.log('       * ' + c));
  }
});
console.log('=========================================================\n');
