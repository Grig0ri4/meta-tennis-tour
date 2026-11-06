/**
 * Meta Tennis Tour — Стартовая база 300 игроков (data/players.js)
 * Каноническая база «Вселенная Автора (Канон)» на 02 января 2024 года:
 * - Первые 140 игроков — оригинальная кастомная база автора (сохранены ID, имена, страны и даты рождения).
 * - Топ-10 строго соответствует итогам сезона 2023 года:
 *   #1 GEO Max Kyupan — 12 300 pts (Пик: #1)
 *   #2 NOR Will Wentra — 11 950 pts (Пик: #2)
 *   #3 SLO Istep Fofol — 6 800 pts (Пик: #1)
 *   #4 USA Ussistian Shifter — 5 050 pts (Пик: #4)
 *   #5 ? Fite Memsy Staprin — 4 690 pts (Пик: #5)
 *   #6 CHI Puddy Mexalino — 4 060 pts (Пик: #4)
 *   #7 USA Gary Riffay — 3 800 pts (Пик: #6)
 *   #8 ? Omar Netigios — 3 300 pts (Пик: #8)
 *   #9 ? Pen Klak — 3 130 pts (Пик: #9)
 *   #10 ? Shaun Salkar — 2 870 pts (Пик: #5)
 * - У игроков с 11 по 300 место сохранены их законные базовые очки, у всех racePoints = 0.
 * - Включает генератор процедурного мира на 300 случайных игроков (возраст 17–35 лет) для новых вселенных.
 */

export const CANONICAL_TOP10_SPECS = {
  'Max Kyupan': { rank: 1, points: 12300, bestRank: 1, flag: 'GEO' },
  'Will Wentra': { rank: 2, points: 11950, bestRank: 2, flag: 'NOR' },
  'Istep Fofol': { rank: 3, points: 6800, bestRank: 1, flag: 'SLO' },
  'Ussistian Shifter': { rank: 4, points: 5050, bestRank: 4, flag: 'USA' },
  'Fite Memsy Staprin': { rank: 5, points: 4690, bestRank: 5, flag: '?' },
  'Puddy Mexalino': { rank: 6, points: 4060, bestRank: 4, flag: 'CHI' },
  'Gary Riffay': { rank: 7, points: 3800, bestRank: 6, flag: 'USA' },
  'Omar Netigios': { rank: 8, points: 3300, bestRank: 8, flag: '?' },
  'Pen Klak': { rank: 9, points: 3130, bestRank: 9, flag: '?' },
  'Shaun Salkar': { rank: 10, points: 2870, bestRank: 5, flag: '?' }
};

export const PRESERVED_BASE = [
  { id: 'p_1', rank: 3, name: 'Istep Fofol', flag: 'SLO', points: 6800, bestRank: 1, birthDate: '1988-04-20' },
  { id: 'p_2', rank: 2, name: 'Will Wentra', flag: 'NOR', points: 11950, bestRank: 2, birthDate: '2002-05-05' },
  { id: 'p_3', rank: 1, name: 'Max Kyupan', flag: 'GEO', points: 12300, bestRank: 1, birthDate: '1990-01-13' },
  { id: 'p_4', rank: 6, name: 'Puddy Mexalino', flag: 'CHI', points: 4060, bestRank: 4, birthDate: '1993-08-17' },
  { id: 'p_5', rank: 10, name: 'Shaun Salkar', flag: '?', points: 2870, bestRank: 5, birthDate: '1992-07-27' },
  { id: 'p_6', rank: 7, name: 'Gary Riffay', flag: 'USA', points: 3800, bestRank: 6, birthDate: '2000-05-30' },
  { id: 'p_7', rank: 11, name: 'Shramysul Leontiev', flag: 'UKR', points: 2810, bestRank: 7, birthDate: '1992-12-16' },
  { id: 'p_8', rank: 5, name: 'Fite Memsy Staprin', flag: '?', points: 4690, bestRank: 5, birthDate: '1998-01-05' },
  { id: 'p_9', rank: 8, name: 'Omar Netigios', flag: '?', points: 3300, bestRank: 8, birthDate: '2002-03-14' },
  { id: 'p_10', rank: 23, name: 'Markon Leoxan', flag: '?', points: 1770, bestRank: 10, birthDate: '1993-11-14' },
  { id: 'p_11', rank: 39, name: 'Robert Galley', flag: 'SWE', points: 1265, bestRank: 11, birthDate: '1987-04-25' },
  { id: 'p_12', rank: 9, name: 'Pen Klak', flag: '?', points: 3130, bestRank: 9, birthDate: '1998-09-09' },
  { id: 'p_13', rank: 12, name: 'Pusto Gerl', flag: '?', points: 2780, bestRank: 12, birthDate: '1995-06-12' },
  { id: 'p_14', rank: 34, name: 'Mercon Leri Toblik', flag: 'IT', points: 1370, bestRank: 14, birthDate: '1990-03-15' },
  { id: 'p_15', rank: 89, name: 'Oliver Stelalir', flag: '?', points: 850, bestRank: 15, birthDate: '1997-03-29' },
  { id: 'p_16', rank: 14, name: 'Putter Price', flag: '?', points: 2730, bestRank: 14, birthDate: '1999-07-27' },
  { id: 'p_17', rank: 19, name: 'Lukas Chelsovinty', flag: '?', points: 1970, bestRank: 17, birthDate: '2000-02-24' },
  { id: 'p_18', rank: 120, name: 'Bob Torsanir', flag: '?', points: 745, bestRank: 18, birthDate: '1999-07-25' },
  { id: 'p_19', rank: 60, name: 'Venn Hentay', flag: '?', points: 1030, bestRank: 19, birthDate: '2000-12-09' },
  { id: 'p_20', rank: 16, name: 'Tiago Logik', flag: '?', points: 2650, bestRank: 16, birthDate: '2001-01-18' },
  { id: 'p_21', rank: 27, name: 'Sumaul Erpolast', flag: 'PAR', points: 1575, bestRank: 21, birthDate: '1992-01-12' },
  { id: 'p_22', rank: 4, name: 'Ussistian Shifter', flag: 'USA', points: 5050, bestRank: 4, birthDate: '2001-06-19' },
  { id: 'p_23', rank: 46, name: 'Matthew Giblisis', flag: 'ITA', points: 1180, bestRank: 23, birthDate: '1989-10-20' },
  { id: 'p_24', rank: 45, name: 'Spam Kyutol Robertson', flag: '?', points: 1195, bestRank: 24, birthDate: '1996-05-02' },
  { id: 'p_25', rank: 18, name: 'Norbert Zembaloft', flag: '?', points: 2090, bestRank: 18, birthDate: '1997-08-11' },
  { id: 'p_26', rank: 52, name: 'Jeblay Celomynyry', flag: 'ITA', points: 1115, bestRank: 26, birthDate: '1983-05-28' },
  { id: 'p_27', rank: 13, name: 'Albert Tarakallo', flag: '?', points: 2780, bestRank: 13, birthDate: '1994-12-16' },
  { id: 'p_28', rank: 15, name: 'Francolin Memso Gul', flag: '?', points: 2730, bestRank: 15, birthDate: '1996-09-03' },
  { id: 'p_29', rank: 42, name: 'Vorb Blaostie', flag: '?', points: 1215, bestRank: 29, birthDate: '1996-10-20' },
  { id: 'p_30', rank: 20, name: 'Vyacheslavv Abashev', flag: 'RUS', points: 1945, bestRank: 20, birthDate: '1997-03-01' },
  { id: 'p_31', rank: 181, name: 'Mitep Kraos Mesh', flag: '?', points: 610, bestRank: 31, birthDate: '1993-08-13' },
  { id: 'p_32', rank: 62, name: 'Tonnie Hunter', flag: '?', points: 1020, bestRank: 32, birthDate: '1999-08-13' },
  { id: 'p_33', rank: 22, name: 'Freddy Johnson', flag: 'SWE', points: 1855, bestRank: 22, birthDate: '2001-04-06' },
  { id: 'p_34', rank: 51, name: 'Ilian Verity', flag: 'JPN', points: 1120, bestRank: 34, birthDate: '1991-05-18' },
  { id: 'p_35', rank: 24, name: 'xl let pu', flag: 'CHN', points: 1660, bestRank: 24, birthDate: '1997-01-14' },
  { id: 'p_36', rank: 54, name: 'Inint Rororasp', flag: 'NOR', points: 1105, bestRank: 36, birthDate: '1992-03-20' },
  { id: 'p_37', rank: 175, name: 'Gael Peterson', flag: 'FRA', points: 630, bestRank: 37, birthDate: '2003-09-19' },
  { id: 'p_38', rank: 130, name: 'Matthew Mat', flag: 'USA', points: 725, bestRank: 38, birthDate: '1996-12-30' },
  { id: 'p_39', rank: 147, name: 'chille Ham Tochesty', flag: 'SPN', points: 680, bestRank: 39, birthDate: '1983-03-11' },
  { id: 'p_40', rank: 93, name: 'Rifat Moscariv', flag: 'RUS', points: 825, bestRank: 40, birthDate: '1994-01-09' },
  { id: 'p_41', rank: 17, name: 'Sepsor Loreo', flag: 'ITA', points: 2590, bestRank: 17, birthDate: '1989-11-26' },
  { id: 'p_42', rank: 32, name: 'Rebekka Yentif', flag: '?', points: 1485, bestRank: 32, birthDate: '2001-11-13' },
  { id: 'p_43', rank: 102, name: 'Ryugo Gaston', flag: '?', points: 785, bestRank: 43, birthDate: '1993-03-15' },
  { id: 'p_44', rank: 78, name: 'Egor Navalo', flag: 'KAZ', points: 880, bestRank: 44, birthDate: '1993-04-15' },
  { id: 'p_45', rank: 26, name: 'Chen Cnang', flag: 'KOR', points: 1590, bestRank: 26, birthDate: '2000-12-15' },
  { id: 'p_46', rank: 137, name: 'Erllif Redlin', flag: 'AUS', points: 700, bestRank: 46, birthDate: '1995-06-20' },
  { id: 'p_47', rank: 113, name: 'Rikko Drakosko', flag: '?', points: 765, bestRank: 47, birthDate: '2000-11-07' },
  { id: 'p_48', rank: 63, name: 'Boris Pechkin', flag: 'BOL', points: 1015, bestRank: 48, birthDate: '1994-03-05' },
  { id: 'p_49', rank: 98, name: 'Saron Pool', flag: '?', points: 810, bestRank: 49, birthDate: '1992-11-09' },
  { id: 'p_50', rank: 158, name: 'Mihaeras Pia-Tako', flag: '?', points: 660, bestRank: 50, birthDate: '1991-02-04' },
  { id: 'p_51', rank: 30, name: 'Erllif Stretich', flag: '?', points: 1505, bestRank: 30, birthDate: '1994-08-30' },
  { id: 'p_52', rank: 48, name: 'Alexander Provines', flag: 'RUS', points: 1150, bestRank: 48, birthDate: '1995-06-10' },
  { id: 'p_53', rank: 121, name: 'Tiago Pyu', flag: 'FRA', points: 745, bestRank: 53, birthDate: '2001-05-06' },
  { id: 'p_54', rank: 148, name: 'Dobeston Tintareo', flag: '?', points: 680, bestRank: 54, birthDate: '1996-10-16' },
  { id: 'p_55', rank: 231, name: 'Tonnie Rogga Reggy', flag: '?', points: 505, bestRank: 55, birthDate: '1999-03-04' },
  { id: 'p_56', rank: 79, name: 'Tanassi Swap', flag: '?', points: 875, bestRank: 56, birthDate: '1997-06-02' },
  { id: 'p_57', rank: 49, name: 'Dustin Nilly', flag: '?', points: 1135, bestRank: 49, birthDate: '1990-08-04' },
  { id: 'p_58', rank: 53, name: 'Ilias Romos-silie', flag: '?', points: 1115, bestRank: 53, birthDate: '1999-11-29' },
  { id: 'p_59', rank: 183, name: 'Fe Tio', flag: 'KOR', points: 605, bestRank: 59, birthDate: '2001-03-24' },
  { id: 'p_60', rank: 55, name: 'Nikola Sokos', flag: '?', points: 1085, bestRank: 55, birthDate: '1988-09-20' },
  { id: 'p_61', rank: 257, name: 'Pleko Yunt', flag: 'SWE', points: 455, bestRank: 61, birthDate: '1989-07-10' },
  { id: 'p_62', rank: 138, name: 'Steve Albot', flag: '?', points: 700, bestRank: 62, birthDate: '1994-02-19' },
  { id: 'p_63', rank: 21, name: 'Garry Cokalsa', flag: 'BRA', points: 1875, bestRank: 21, birthDate: '2001-12-12' },
  { id: 'p_64', rank: 56, name: 'Alex Bolt', flag: '?', points: 1080, bestRank: 56, birthDate: '1999-11-27' },
  { id: 'p_65', rank: 36, name: 'Jho Flattin', flag: '?', points: 1305, bestRank: 36, birthDate: '1995-09-18' },
  { id: 'p_66', rank: 127, name: 'Ylen Nofredrie', flag: '?', points: 735, bestRank: 66, birthDate: '1986-11-27' },
  { id: 'p_67', rank: 165, name: 'Fetty Yolton', flag: '?', points: 645, bestRank: 67, birthDate: '2001-08-12' },
  { id: 'p_68', rank: 240, name: 'Patrick Putorka', flag: '?', points: 485, bestRank: 68, birthDate: '1992-09-30' },
  { id: 'p_69', rank: 29, name: 'Hindy Yamaika', flag: '?', points: 1530, bestRank: 29, birthDate: '1997-01-26' },
  { id: 'p_70', rank: 104, name: 'Astofada Ruud', flag: '?', points: 780, bestRank: 70, birthDate: '2000-04-09' },
  { id: 'p_71', rank: 35, name: 'Leonid Kyut', flag: 'RUS', points: 1315, bestRank: 35, birthDate: '1994-10-05' },
  { id: 'p_72', rank: 71, name: 'Erllif Dlerkic', flag: '?', points: 940, bestRank: 71, birthDate: '1994-07-12' },
  { id: 'p_73', rank: 57, name: 'Boris Brykrot', flag: '?', points: 1070, bestRank: 57, birthDate: '1989-11-25' },
  { id: 'p_74', rank: 80, name: 'Mikhail Zhivnoy', flag: 'RUS', points: 870, bestRank: 74, birthDate: '1998-09-27' },
  { id: 'p_75', rank: 31, name: 'Tommie Temprey', flag: '?', points: 1490, bestRank: 31, birthDate: '1990-04-22' },
  { id: 'p_76', rank: 139, name: 'Teddy Fedesenen', flag: '?', points: 695, bestRank: 76, birthDate: '1997-04-13' },
  { id: 'p_77', rank: 28, name: 'Sam Spore', flag: '?', points: 1555, bestRank: 28, birthDate: '1992-01-20' },
  { id: 'p_78', rank: 25, name: 'Kasstin Aramaz', flag: '?', points: 1660, bestRank: 25, birthDate: '2002-08-27' },
  { id: 'p_79', rank: 105, name: 'Zonda Zewy', flag: '?', points: 780, bestRank: 79, birthDate: '2000-02-10' },
  { id: 'p_80', rank: 37, name: 'Oscar Christian', flag: '?', points: 1300, bestRank: 37, birthDate: '2000-10-04' },
  { id: 'p_81', rank: 66, name: 'Lerka Spinseh', flag: '?', points: 965, bestRank: 66, birthDate: '1986-03-05' },
  { id: 'p_82', rank: 143, name: 'Olias Forgnine', flag: '?', points: 690, bestRank: 82, birthDate: '2001-05-11' },
  { id: 'p_83', rank: 117, name: 'Nikola Tortalo', flag: '?', points: 755, bestRank: 83, birthDate: '1999-07-25' },
  { id: 'p_84', rank: 33, name: 'Zassen Ziroe', flag: '?', points: 1435, bestRank: 33, birthDate: '2001-02-10' },
  { id: 'p_85', rank: 109, name: 'Felix Stepashko', flag: '?', points: 770, bestRank: 85, birthDate: '1999-01-29' },
  { id: 'p_86', rank: 68, name: 'Takeshi Mori', flag: 'JPN', points: 955, bestRank: 68, birthDate: '2000-01-15' },
  { id: 'p_87', rank: 38, name: 'Roman Wolf', flag: 'GER', points: 1300, bestRank: 38, birthDate: '1997-10-15' },
  { id: 'p_88', rank: 81, name: 'Innat Dagimov', flag: 'TAD', points: 870, bestRank: 81, birthDate: '2002-07-06' },
  { id: 'p_89', rank: 122, name: 'Ben Sherlok', flag: 'FRA', points: 745, bestRank: 89, birthDate: '2002-03-15' },
  { id: 'p_90', rank: 114, name: 'Donti Klawa', flag: '?', points: 765, bestRank: 90, birthDate: '1984-10-19' },
  { id: 'p_91', rank: 184, name: 'Pleko Yunt', flag: 'SWE', points: 605, bestRank: 91, birthDate: '1989-07-10' },
  { id: 'p_92', rank: 134, name: 'Vadim Yumbov', flag: '?', points: 710, bestRank: 92, birthDate: '1991-03-04' },
  { id: 'p_93', rank: 43, name: 'Mihaeras Pia-Tako', flag: '?', points: 1215, bestRank: 43, birthDate: '1991-02-04' },
  { id: 'p_94', rank: 74, name: 'Teddy Fedesenen', flag: '?', points: 900, bestRank: 74, birthDate: '1997-04-13' },
  { id: 'p_95', rank: 182, name: 'Nikola Tortalo', flag: '?', points: 610, bestRank: 95, birthDate: '1999-07-25' },
  { id: 'p_96', rank: 65, name: 'Julian Papai-tons', flag: '?', points: 975, bestRank: 65, birthDate: '1996-08-15' },
  { id: 'p_97', rank: 251, name: 'Mya Hohia', flag: '?', points: 465, bestRank: 97, birthDate: '1984-11-13' },
  { id: 'p_98', rank: 83, name: 'Vesnot Gakov', flag: 'BUL', points: 865, bestRank: 83, birthDate: '1995-11-15' },
  { id: 'p_99', rank: 246, name: 'Grek Robertson', flag: '?', points: 475, bestRank: 99, birthDate: '1994-12-27' },
  { id: 'p_100', rank: 99, name: 'Jack Kremlino', flag: '?', points: 810, bestRank: 99, birthDate: '1996-08-16' },
  { id: 'p_101', rank: 123, name: 'Lobentio Harrington', flag: 'ITA', points: 740, bestRank: 101, birthDate: '2004-10-25' },
  { id: 'p_102', rank: 100, name: 'Nvally Haidjovic', flag: 'SRB', points: 805, bestRank: 100, birthDate: '1989-09-07' },
  { id: 'p_103', rank: 164, name: 'Soren Hansen', flag: 'NOR', points: 650, bestRank: 103, birthDate: '1997-07-10' },
  { id: 'p_104', rank: 67, name: 'Frost Doljnish', flag: 'SRB', points: 960, bestRank: 67, birthDate: '2002-05-24' },
  { id: 'p_105', rank: 75, name: 'Temkos Timmy', flag: '?', points: 900, bestRank: 75, birthDate: '2002-08-06' },
  { id: 'p_106', rank: 64, name: 'Zonda Zewy', flag: '?', points: 985, bestRank: 64, birthDate: '2000-02-10' },
  { id: 'p_107', rank: 119, name: 'Timoty Klastifir', flag: 'GEO', points: 750, bestRank: 107, birthDate: '1995-05-20' },
  { id: 'p_108', rank: 221, name: 'Sebastian Offset', flag: 'SUI', points: 525, bestRank: 108, birthDate: '1990-03-15' },
  { id: 'p_109', rank: 85, name: 'Fill Dozzov', flag: '?', points: 860, bestRank: 85, birthDate: '2003-11-25' },
  { id: 'p_110', rank: 92, name: 'Anatoly Fipomba', flag: 'RUS', points: 830, bestRank: 92, birthDate: '2000-02-19' },
  { id: 'p_111', rank: 124, name: 'Zekias Charmen', flag: 'CAN', points: 740, bestRank: 111, birthDate: '1997-08-10' },
  { id: 'p_112', rank: 223, name: 'Albert Nacho', flag: '?', points: 515, bestRank: 112, birthDate: '1988-09-28' },
  { id: 'p_113', rank: 61, name: 'Glino Pozzman', flag: '?', points: 1030, bestRank: 61, birthDate: '1991-10-30' },
  { id: 'p_114', rank: 58, name: 'Dustin Spilberg', flag: '?', points: 1050, bestRank: 58, birthDate: '1994-01-29' },
  { id: 'p_115', rank: 177, name: 'Felix Duval', flag: 'SUI', points: 625, bestRank: 115, birthDate: '1993-08-30' },
  { id: 'p_116', rank: 283, name: 'Kompod Kryzhov', flag: '?', points: 405, bestRank: 116, birthDate: '1999-02-25' },
  { id: 'p_117', rank: 50, name: 'Viada Praty', flag: '?', points: 1125, bestRank: 50, birthDate: '1998-10-21' },
  { id: 'p_118', rank: 156, name: 'Danila Pushka', flag: 'BOL', points: 665, bestRank: 118, birthDate: '1994-12-03' },
  { id: 'p_119', rank: 97, name: 'Christan Fass', flag: 'USA', points: 815, bestRank: 97, birthDate: '1993-10-03' },
  { id: 'p_120', rank: 44, name: 'Arnold Han', flag: 'GBR', points: 1205, bestRank: 44, birthDate: '2000-04-05' },
  { id: 'p_121', rank: 213, name: 'Josh Vashington', flag: 'USA', points: 540, bestRank: 121, birthDate: '1998-10-15' },
  { id: 'p_122', rank: 232, name: 'Gabriel Chashka', flag: '?', points: 505, bestRank: 122, birthDate: '1994-12-24' },
  { id: 'p_123', rank: 106, name: 'Matthew Vereshevskiy', flag: 'FRA', points: 780, bestRank: 106, birthDate: '2002-04-30' },
  { id: 'p_124', rank: 201, name: 'Von Drols', flag: 'GER', points: 565, bestRank: 124, birthDate: '1990-05-25' },
  { id: 'p_125', rank: 163, name: 'Ma Xo Fea', flag: 'CHN', points: 655, bestRank: 125, birthDate: '2004-11-06' },
  { id: 'p_126', rank: 82, name: 'Leonardo Di-Pastio', flag: 'FRA', points: 870, bestRank: 82, birthDate: '1996-11-06' },
  { id: 'p_127', rank: 222, name: 'Maxime Sokolov', flag: 'BEL', points: 520, bestRank: 127, birthDate: '1999-02-12' },
  { id: 'p_128', rank: 166, name: 'Carallo Baraballo', flag: '?', points: 645, bestRank: 128, birthDate: '2003-06-11' },
  { id: 'p_129', rank: 202, name: 'Larry Kowald', flag: '?', points: 565, bestRank: 129, birthDate: '1998-06-15' },
  { id: 'p_130', rank: 203, name: 'Donatello Dodlon', flag: '?', points: 565, bestRank: 130, birthDate: '2000-03-31' },
  { id: 'p_131', rank: 69, name: 'Shon Hugok', flag: '?', points: 955, bestRank: 69, birthDate: '2000-08-26' },
  { id: 'p_132', rank: 167, name: 'Felix Dhjagernaut', flag: '?', points: 645, bestRank: 132, birthDate: '1995-07-17' },
  { id: 'p_133', rank: 237, name: 'Stepan Goggi', flag: '?', points: 495, bestRank: 133, birthDate: '1990-05-27' },
  { id: 'p_134', rank: 212, name: 'Bemianin Hoiyka', flag: '?', points: 545, bestRank: 134, birthDate: '2001-04-01' },
  { id: 'p_135', rank: 103, name: 'Fharaonzi Gas-Tremshio', flag: '?', points: 785, bestRank: 103, birthDate: '1999-12-25' },
  { id: 'p_136', rank: 140, name: 'Pen Jack', flag: '?', points: 695, bestRank: 136, birthDate: '1996-05-10' },
  { id: 'p_137', rank: 118, name: 'Rokkie Rassac', flag: '?', points: 755, bestRank: 118, birthDate: '1989-03-26' },
  { id: 'p_138', rank: 107, name: 'Kyle Madasanskiy', flag: '?', points: 775, bestRank: 107, birthDate: '2002-01-29' },
  { id: 'p_139', rank: 224, name: 'Milan Kovacic', flag: 'GER', points: 515, bestRank: 139, birthDate: '1996-11-15' },
  { id: 'p_140', rank: 40, name: 'Lars Nielsen', flag: 'ESP', points: 1245, bestRank: 40, birthDate: '1990-03-15' }
];

// 160+ уникальных благозвучных имен на латинице БЕЗ цифр (возраст от 17 до 37 лет в 2024 году: 1987..2007)
export const CLEAN_UNIQUE_POOL = [
  { name: "Cedric Leroy", flag: "FRA", b: "1997-04-12" },
  { name: "Marco Bellini", flag: "ITA", b: "1995-11-20" },
  { name: "Lucas Van Der Meer", flag: "NED", b: "2001-03-08" },
  { name: "Fabio Fragian", flag: "ITA", b: "1994-05-17" },
  { name: "Mateo Gutierrez", flag: "ARG", b: "1998-09-14" },
  { name: "Julian Thorne", flag: "GBR", b: "2003-01-22" },
  { name: "Nikolai Lind", flag: "DEN", b: "2000-06-19" },
  { name: "Tristan Vance", flag: "USA", b: "1994-08-30" },
  { name: "Kaito Takahashi", flag: "JPN", b: "2002-10-11" },
  { name: "Benoit Chabal", flag: "FRA", b: "1992-12-05" },
  { name: "Kevin Lidirt", flag: "ITA", b: "1987-08-27" },
  { name: "Carlos Alcantara", flag: "ESP", b: "2004-05-18" },
  { name: "Fabian Schultheiss", flag: "GER", b: "1996-07-23" },
  { name: "Sean O'Sullivan", flag: "IRL", b: "1999-02-14" },
  { name: "Dmitry Volkov", flag: "RUS", b: "1993-10-09" },
  { name: "Miloslav Cech", flag: "CZE", b: "1991-03-27" },
  { name: "Casper Holm", flag: "NOR", b: "2001-08-16" },
  { name: "Henrik Vang", flag: "SWE", b: "1995-04-03" },
  { name: "Enzo Moretti", flag: "ITA", b: "2003-11-28" },
  { name: "Joao Silveira", flag: "BRA", b: "1998-06-12" },
  { name: "Stefan Petrovic", flag: "SRB", b: "1990-09-02" },
  { name: "Luka Horvat", flag: "CRO", b: "1997-01-31" },
  { name: "Arthur Pendleton", flag: "USA", b: "1996-12-18" },
  { name: "Niels De Jong", flag: "NED", b: "2002-04-25" },
  { name: "Gabriel Montalbano", flag: "ARG", b: "1994-02-15" },
  { name: "Oliver Crawford", flag: "GBR", b: "2000-07-07" },
  { name: "Damian Zoric", flag: "SRB", b: "1999-05-19" },
  { name: "Christian Becker", flag: "GER", b: "1993-08-11" },
  { name: "Honda Heryr", flag: "JPN", b: "1994-07-26" },
  { name: "Noah Lemaire", flag: "FRA", b: "2005-02-09" },
  { name: "Alvaro Benitez", flag: "ESP", b: "1992-11-13" },
  { name: "Liam MacIntyre", flag: "AUS", b: "1998-03-24" },
  { name: "Kenji Watanabe", flag: "JPN", b: "2001-12-04" },
  { name: "Valentin Roig", flag: "SUI", b: "1997-10-21" },
  { name: "Matias Fonseca", flag: "CHI", b: "1995-01-08" },
  { name: "Sergei Belov", flag: "RUS", b: "1989-06-29" },
  { name: "Tibor Kovacs", flag: "HUN", b: "1996-09-17" },
  { name: "Dante Castiglione", flag: "ITA", b: "2002-08-14" },
  { name: "Simon Lindstrom", flag: "SWE", b: "1994-04-18" },
  { name: "Bryan Gallagher", flag: "USA", b: "2000-11-03" },
  { id_hint: 41, name: "Frederik Mikkelsen", flag: "DEN", b: "1998-07-26" },
  { name: "Gaston Del Valle", flag: "ARG", b: "1991-05-15" },
  { name: "Marc Tremblay", flag: "CAN", b: "2003-03-12" },
  { name: "Robin Visser", flag: "NED", b: "1988-12-01" },
  { name: "Karlo Simunic", flag: "CRO", b: "1997-02-28" },
  { name: "Adrien Faure", flag: "FRA", b: "2001-09-09" },
  { name: "Ignacio Peralta", flag: "COL", b: "1995-12-22" },
  { name: "Dominik Weber", flag: "AUT", b: "1999-08-05" },
  { name: "Rodrigo Santana", flag: "BRA", b: "1993-04-17" },
  { name: "Nikita Orlov", flag: "RUS", b: "2002-01-19" },
  { name: "Elias Sjoborg", flag: "NOR", b: "2004-10-30" },
  { name: "Hugo Beaumont", flag: "GBR", b: "1996-03-16" },
  { name: "Vicente Morales", flag: "ESP", b: "1990-07-20" },
  { name: "Tobias Sommer", flag: "GER", b: "2000-05-14" },
  { name: "Lukas Berglund", flag: "FIN", b: "1998-11-10" },
  { name: "Kacper Wolski", flag: "POL", b: "2002-06-27" },
  { name: "Andrea Santoro", flag: "ITA", b: "1994-10-06" },
  { name: "Diego Carballo", flag: "URU", b: "1997-08-25" },
  { name: "Tyler Henderson", flag: "USA", b: "2003-09-03" },
  { name: "Maxence Laurent", flag: "FRA", b: "2001-04-14" },
  { name: "Florian Zeiler", flag: "SUI", b: "1995-02-18" },
  { name: "Arvid Lindholm", flag: "SWE", b: "2002-07-15" },
  { name: "Pablo Mendoza", flag: "MEX", b: "1996-01-26" },
  { name: "Dusan Lazic", flag: "SRB", b: "1999-09-18" },
  { name: "Emil Vestergaard", flag: "DEN", b: "2003-05-22" },
  { name: "Mathieu Gauthier", flag: "CAN", b: "1997-03-10" },
  { name: "Goran Vucic", flag: "CRO", b: "1991-08-07" },
  { name: "Ramiro Fabbri", flag: "ITA", b: "2000-12-14" },
  { name: "Soren Dahl", flag: "NOR", b: "1998-04-29" },
  { name: "Maximilian Althaus", flag: "GER", b: "1993-11-05" },
  { name: "Jorge Salgado", flag: "ESP", b: "2001-02-17" },
  { name: "Valerio Barone", flag: "ITA", b: "1995-06-30" },
  { name: "Tomas Vanecek", flag: "CZE", b: "2002-11-12" },
  { name: "Hauke Bruns", flag: "GER", b: "1994-09-08" },
  { name: "Bautista Roldan", flag: "ARG", b: "2004-03-19" },
  { name: "Callum Fraser", flag: "GBR", b: "1999-07-21" },
  { name: "Timo Haapala", flag: "FIN", b: "1996-10-15" },
  { name: "Yuki Morita", flag: "JPN", b: "2003-08-04" },
  { name: "Benoit Duclos", flag: "FRA", b: "1992-05-27" },
  { name: "Martin Kolar", flag: "SVK", b: "1998-01-11" },
  { name: "Luciano Rios", flag: "CHI", b: "2000-09-23" },
  { name: "Florin Ionescu", flag: "ROU", b: "1995-12-03" },
  { name: "Dario Fontana", flag: "SUI", b: "1997-06-18" },
  { name: "Zdenek Pospisil", flag: "CZE", b: "1993-04-22" },
  { name: "Jesper Nygard", flag: "SWE", b: "2001-10-09" },
  { name: "Esteban Aranda", flag: "PAR", b: "1999-03-31" },
  { name: "Giles Montgomery", flag: "AUS", b: "1994-07-14" },
  { name: "Filippo De Angelis", flag: "ITA", b: "2002-05-08" },
  { name: "Sven Van Dijk", flag: "NED", b: "1996-08-27" },
  { name: "Alexandre Mercier", flag: "BEL", b: "2000-02-16" },
  { name: "Tadej Vodopivec", flag: "SLO", b: "2003-12-05" },
  { name: "Kamen Dimitrov", flag: "BUL", b: "1991-11-19" },
  { name: "Rui Barbosa", flag: "POR", b: "1998-09-02" },
  { name: "Clemens Holzer", flag: "AUT", b: "1995-03-13" },
  { name: "Miron Turgenev", flag: "RUS", b: "2004-01-25" },
  { name: "Vasco Fernandes", flag: "POR", b: "1997-07-06" },
  { name: "Magnus Lindqvist", flag: "SWE", b: "1993-10-31" },
  { name: "Kieran Gallagher", flag: "IRL", b: "2001-06-20" },
  { name: "Ondrej Sedlak", flag: "CZE", b: "1996-02-04" },
  { name: "Giacomo Vianello", flag: "ITA", b: "2002-09-17" },
  { name: "Rafael Delgado", flag: "ESP", b: "1999-04-11" },
  { name: "Quentin Moreau", flag: "FRA", b: "2000-08-22" },
  { name: "Harrison Brooks", flag: "USA", b: "1995-11-09" },
  { name: "Leonardo Conti", flag: "ITA", b: "2004-02-14" },
  { name: "Lukas Gruber", flag: "AUT", b: "1997-09-28" },
  { name: "Shohei Nishimura", flag: "JPN", b: "2001-05-03" },
  { name: "Thiago Monteiro", flag: "BRA", b: "1994-06-19" },
  { name: "Moritz Hartmann", flag: "GER", b: "2002-12-08" },
  { name: "Facundo Navarro", flag: "ARG", b: "1998-03-15" },
  { name: "Lachlan Mitchell", flag: "AUS", b: "2000-10-27" },
  { name: "Viktor Troicki", flag: "SRB", b: "1992-07-04" },
  { name: "Corentin Chevalier", flag: "FRA", b: "2005-01-19" },
  { name: "Alistair MacLeod", flag: "GBR", b: "1996-05-24" },
  { name: "Gonzalo Herrera", flag: "ESP", b: "2001-11-30" },
  { name: "Joris Van Den Berg", flag: "NED", b: "1999-08-12" },
  { name: "Szymon Kowalczyk", flag: "POL", b: "2003-04-05" },
  { name: "Cristian Villarroel", flag: "CHI", b: "1997-12-16" },
  { name: "Rasmus Lindgren", flag: "SWE", b: "2002-02-28" },
  { name: "Matteo Lombardo", flag: "ITA", b: "1995-09-07" },
  { name: "Brandon Sterling", flag: "USA", b: "2004-06-11" },
  { name: "Yannick Baumann", flag: "SUI", b: "1998-10-02" },
  { name: "Renato Pacheco", flag: "POR", b: "2000-01-23" },
  { name: "Mikhail Voronov", flag: "RUS", b: "1993-05-14" },
  { name: "Damir Kovačević", flag: "BIH", b: "1996-11-18" },
  { name: "Eero Makinen", flag: "FIN", b: "2001-07-29" },
  { name: "Thibault Garnier", flag: "FRA", b: "1999-03-09" },
  { name: "Joaquin Ibarra", flag: "ARG", b: "2003-08-21" },
  { name: "Declan Byrne", flag: "IRL", b: "1997-04-17" },
  { name: "Benedikt Vogel", flag: "GER", b: "2000-12-01" },
  { name: "Haruto Saito", flag: "JPN", b: "2004-09-13" },
  { name: "Lorenzo Ferretti", flag: "ITA", b: "1998-05-26" },
  { name: "Colton Wheeler", flag: "USA", b: "2002-03-04" },
  { name: "Aleksei Morozov", flag: "KAZ", b: "1995-08-15" },
  { name: "Petar Jovanovic", flag: "SRB", b: "2001-10-08" },
  { name: "Iker Mendoza", flag: "ESP", b: "2005-04-22" },
  { name: "Cooper Reid", flag: "AUS", b: "1999-01-12" },
  { name: "Bastien Lefevre", flag: "FRA", b: "1994-11-25" },
  { name: "Vojtech Novak", flag: "CZE", b: "2000-06-06" },
  { name: "Kristian Solberg", flag: "NOR", b: "2003-02-18" },
  { name: "Federico Valdes", flag: "URG", b: "1996-07-09" },
  { name: "Pietro Marchetti", flag: "ITA", b: "2002-10-19" },
  { name: "Graham Kensington", flag: "GBR", b: "1993-12-30" },
  { name: "Lasse Pedersen", flag: "DEN", b: "2001-01-14" },
  { name: "Zoran Milosevic", flag: "SRB", b: "1997-08-03" },
  { name: "Ruben Castellanos", flag: "ESP", b: "2004-07-16" },
  { name: "Nolan Bouchard", flag: "CAN", b: "2000-03-27" },
  { name: "Lennart Richter", flag: "GER", b: "1998-09-11" },
  { name: "Takumi Hayashi", flag: "JPN", b: "2003-11-02" },
  { name: "Santiago Caceres", flag: "ARG", b: "1995-04-24" },
  { name: "Maximilian Hofbauer", flag: "AUT", b: "2002-08-07" },
  { name: "Guillaume Renaud", flag: "FRA", b: "1996-02-19" },
  { name: "Preston Vance", flag: "USA", b: "2005-05-30" },
  { name: "Edoardo Galli", flag: "ITA", b: "1999-12-12" },
  { name: "Caio Azevedo", flag: "BRA", b: "2001-09-25" },
  { name: "Marin Radic", flag: "CRO", b: "1994-03-08" },
  { name: "Bram Hendriks", flag: "NED", b: "2003-06-14" },
  { name: "Bogdan Stanciu", flag: "ROU", b: "1997-10-29" },
  { name: "Albin Ekstrom", flag: "SWE", b: "2000-04-01" },
  { name: "Artur Zakharov", flag: "RUS", b: "1998-07-19" },
  { name: "Tomasz Kaminski", flag: "POL", b: "1995-01-11" },
  { name: "Leandro Quiroga", flag: "ARG", b: "2004-12-03" },
  { name: "Hamish Campbell", flag: "GBR", b: "2001-08-24" },
  { name: "Nico Schuler", flag: "SUI", b: "1999-05-15" },
  { name: "Javier Dominguez", flag: "ESP", b: "2002-01-07" },
  { name: "Daiki Fujimoto", flag: "JPN", b: "1996-06-28" },
  { name: "Flynn O'Connor", flag: "AUS", b: "2003-10-10" }
];

export const CALIBRATED_2023_POINTS_141_TO_300 = {"p_141":665,"p_142":600,"p_143":675,"p_144":765,"p_145":825,"p_146":685,"p_147":1040,"p_148":705,"p_149":775,"p_150":705,"p_151":820,"p_152":570,"p_153":740,"p_154":605,"p_155":530,"p_156":690,"p_157":855,"p_158":410,"p_159":570,"p_160":435,"p_161":1220,"p_162":840,"p_163":670,"p_164":740,"p_165":635,"p_166":630,"p_167":435,"p_168":770,"p_169":955,"p_170":770,"p_171":430,"p_172":840,"p_173":675,"p_174":725,"p_175":730,"p_176":860,"p_177":500,"p_178":635,"p_179":660,"p_180":670,"p_181":940,"p_182":890,"p_183":640,"p_184":590,"p_185":670,"p_186":825,"p_187":515,"p_188":660,"p_189":735,"p_190":865,"p_191":855,"p_192":715,"p_193":635,"p_194":565,"p_195":590,"p_196":540,"p_197":805,"p_198":1175,"p_199":510,"p_200":565,"p_201":635,"p_202":560,"p_203":515,"p_204":620,"p_205":485,"p_206":635,"p_207":625,"p_208":395,"p_209":770,"p_210":660,"p_211":600,"p_212":475,"p_213":640,"p_214":375,"p_215":905,"p_216":420,"p_217":900,"p_218":580,"p_219":660,"p_220":450,"p_221":570,"p_222":480,"p_223":535,"p_224":485,"p_225":725,"p_226":590,"p_227":355,"p_228":400,"p_229":680,"p_230":490,"p_231":385,"p_232":455,"p_233":695,"p_234":570,"p_235":420,"p_236":400,"p_237":530,"p_238":440,"p_239":480,"p_240":465,"p_241":540,"p_242":620,"p_243":505,"p_244":420,"p_245":515,"p_246":460,"p_247":560,"p_248":510,"p_249":600,"p_250":560,"p_251":535,"p_252":330,"p_253":695,"p_254":350,"p_255":420,"p_256":415,"p_257":570,"p_258":475,"p_259":600,"p_260":375,"p_261":425,"p_262":490,"p_263":445,"p_264":425,"p_265":540,"p_266":555,"p_267":420,"p_268":330,"p_269":420,"p_270":460,"p_271":555,"p_272":320,"p_273":385,"p_274":440,"p_275":420,"p_276":555,"p_277":515,"p_278":690,"p_279":390,"p_280":435,"p_281":475,"p_282":390,"p_283":585,"p_284":390,"p_285":505,"p_286":500,"p_287":400,"p_288":445,"p_289":390,"p_290":760,"p_291":465,"p_292":605,"p_293":425,"p_294":470,"p_295":460,"p_296":415,"p_297":680,"p_298":450,"p_299":445,"p_300":480};

export function buildInitial300Players() {
  const result = PRESERVED_BASE.map((p, idx) => ({
    ...p,
    basePoints: p.points,
    start2023Points: p.points,
    racePoints: 0,
    tournamentPoints: {},
    rankChange: 0,
    bestRank: p.bestRank || p.rank || (idx + 1),
    historicalBestRank: p.bestRank || p.rank || (idx + 1),
    seasonStartRank: p.rank || (idx + 1),
    seasonsPlayed: 1,
    medals: { gold: 0, silver: 0, bronze: 0 }
  }));

  const existingNames = new Set(result.map(p => p.name.toLowerCase()));
  let poolIndex = 0;
  let currentPts = 340;

  while (result.length < 300) {
    while (poolIndex < CLEAN_UNIQUE_POOL.length && existingNames.has(CLEAN_UNIQUE_POOL[poolIndex].name.toLowerCase())) {
      poolIndex++;
    }
    const cleanEntry = CLEAN_UNIQUE_POOL[poolIndex % CLEAN_UNIQUE_POOL.length];
    const fullName = cleanEntry ? cleanEntry.name : `Lucas Vance`;
    const flag = cleanEntry ? cleanEntry.flag : "ESP";
    const bDate = cleanEntry ? cleanEntry.b : "1998-05-15";
    poolIndex++;

    existingNames.add(fullName.toLowerCase());
    const rank = result.length + 1;
    const pts = CALIBRATED_2023_POINTS_141_TO_300["p_" + rank] || Math.max(250, currentPts);
    result.push({
      id: 'p_' + rank,
      rank: rank,
      name: fullName,
      flag: flag,
      points: pts,
      basePoints: pts,
      start2023Points: pts,
      racePoints: 0,
      birthDate: bDate,
      tournamentPoints: {},
      rankChange: 0,
      bestRank: rank,
      historicalBestRank: rank,
      seasonStartRank: rank,
      seasonsPlayed: 1,
      medals: { gold: 0, silver: 0, bronze: 0 }
    });
    currentPts = Math.max(15, currentPts - 2);
  }

  return result;
}

const PROCEDURAL_FIRST_NAMES = [
  "Matteo", "Lucas", "Carlos", "Julian", "Alexander", "Stefan", "Casper", "Lorenzo", "Nikolai", "Gabriel",
  "Rafael", "Dominik", "Sebastian", "Henrik", "Benoit", "Tomas", "Viktor", "Damian", "Arthur", "Kaito",
  "Emil", "Maximilian", "Florian", "Thiago", "Joaquin", "Liam", "Niels", "Andrei", "Luka", "Filippo",
  "Valentin", "Rodrigo", "Soren", "Marco", "Adrian", "Quentin", "Christian", "Elias", "Dante", "Milos",
  "Oliver", "Pablo", "Tadej", "Gaston", "Clemens", "Haruto", "Ruben", "Felix", "oscars", "Xavier"
].map(s => s.charAt(0).toUpperCase() + s.slice(1));

const PROCEDURAL_LAST_NAMES = [
  "Bellini", "Alcantara", "Thorne", "Volkov", "Petrovic", "Holm", "Moretti", "Lind", "Montalbano", "Delgado",
  "Weber", "Roig", "Vang", "Chabal", "Vanecek", "Troicki", "Zoric", "Pendleton", "Takahashi", "Vestergaard",
  "Althaus", "Zeiler", "Monteiro", "Ibarra", "MacIntyre", "De Jong", "Morozov", "Horvat", "De Angelis", "Santana",
  "Dahl", "Santoro", "Faure", "Moreau", "Becker", "Sjoborg", "Castiglione", "Cech", "Crawford", "Mendoza",
  "Vodopivec", "Del Valle", "Holzer", "Saito", "Castellanos", "Duval", "Lindqvist", "Bouchard", "Richter", "Kovacs",
  "Navarro", "Ferretti", "Solberg", "Lombardo", "Mercier", "Kowalczyk", "Barbosa", "Berglund", "Vianello", "Chevalier"
];

const PROCEDURAL_FLAGS = [
  "ESP", "ITA", "FRA", "USA", "SRB", "GER", "RUS", "NOR", "ARG", "GBR",
  "AUS", "SUI", "CAN", "JPN", "CRO", "SWE", "DEN", "NED", "BRA", "CHI",
  "CZE", "POL", "AUT", "BEL", "GRE", "GEO", "SLO", "KAZ", "BUL", "POR"
];

/**
 * Процедурный генератор 300 уникальных игроков для произвольной пользовательской вселенной
 * Возраст: строго от 17 до 35 лет относительно startYear, уникальные имена и флаги, racePoints = 0.
 */
export function generateRandom300Players(startYear = 2024, rng = Math.random) {
  const usedNames = new Set();
  const generated = [];

  // Реалистичная шкала очков для процедурного тура (от #1 ~11800 до #300 ~15)
  const computeProceduralPoints = (rank) => {
    if (rank === 1) return 11850;
    if (rank === 2) return 10400;
    if (rank === 3) return 7950;
    if (rank === 4) return 6400;
    if (rank === 5) return 5350;
    if (rank <= 10) return 5200 - (rank - 5) * 420;
    if (rank <= 30) return 3000 - (rank - 10) * 75;
    if (rank <= 50) return 1500 - (rank - 30) * 34;
    if (rank <= 100) return 1120 - (rank - 50) * 6;
    if (rank <= 200) return 820 - (rank - 100) * 2.5;
    return Math.max(250, Math.round(570 - (rank - 200) * 2.5));
  };

  for (let i = 0; i < 300; i++) {
    const rank = i + 1;
    let fullName = '';
    let attempts = 0;
    while (!fullName || usedNames.has(fullName.toLowerCase())) {
      const fn = PROCEDURAL_FIRST_NAMES[Math.floor(rng() * PROCEDURAL_FIRST_NAMES.length)];
      const ln = PROCEDURAL_LAST_NAMES[Math.floor(rng() * PROCEDURAL_LAST_NAMES.length)];
      fullName = `${fn} ${ln}`;
      attempts++;
      if (attempts > 400) {
        const extra = CLEAN_UNIQUE_POOL[i % CLEAN_UNIQUE_POOL.length]?.name || `Julian Vance`;
        fullName = usedNames.has(extra.toLowerCase()) ? `${fn} ${ln} Jr` : extra;
        break;
      }
    }
    usedNames.add(fullName.toLowerCase());

    const flag = PROCEDURAL_FLAGS[Math.floor(rng() * PROCEDURAL_FLAGS.length)];
    // Возраст 17–35 лет
    const age = 17 + Math.floor(rng() * 19);
    const birthYear = startYear - age;
    const birthMonth = String(1 + Math.floor(rng() * 12)).padStart(2, '0');
    const birthDay = String(1 + Math.floor(rng() * 28)).padStart(2, '0');
    const birthDate = `${birthYear}-${birthMonth}-${birthDay}`;

    const pts = Math.max(15, Math.round(computeProceduralPoints(rank)));
    const prevYear = startYear - 1;
    const regTourneyIds = [
      'm_1', 'tbsh_1', '500_1', '500_2', '500_3', 'm_2', 'm_3', 'm_4', '500_4', 'm_5',
      '500_5', 'tbsh_2', '500_6', '500_7', 'm_6', 'tbsh_3', '500_8', '500_9', 'm_7', 'tbsh_4',
      '500_10', '500_11', 'm_8', '500_12', 'm_9'
    ];
    const tournamentPoints = {};
    let remPts = pts;
    const baseChunk = Math.floor((pts / regTourneyIds.length) / 5) * 5;
    regTourneyIds.forEach((tid, idx) => {
      if (idx === regTourneyIds.length - 1) {
        tournamentPoints[tid] = { [prevYear]: Math.max(0, remPts) };
      } else {
        const val = Math.min(remPts, Math.max(5, baseChunk));
        tournamentPoints[tid] = { [prevYear]: val };
        remPts -= val;
      }
    });

    generated.push({
      id: `p_${rank}`,
      rank,
      name: fullName,
      flag,
      points: pts,
      basePoints: pts,
      start2023Points: pts,
      remainingDefending: pts,
      defendedSoFar: 0,
      finalsPoints: 0,
      racePoints: 0,
      birthDate,
      isProcedural: true,
      tournamentPoints,
      rankChange: 0,
      bestRank: rank,
      historicalBestRank: rank,
      seasonStartRank: rank,
      seasonsPlayed: 1,
      medals: { gold: 0, silver: 0, bronze: 0 }
    });
  }

  return generated;
}

if (typeof window !== 'undefined') {
  window.PRESERVED_BASE = PRESERVED_BASE;
  window.CLEAN_UNIQUE_POOL = CLEAN_UNIQUE_POOL;
  window.buildInitial300Players = buildInitial300Players;
  window.generateRandom300Players = generateRandom300Players;
}
