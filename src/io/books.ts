import type { Testament } from '@/domain/schema';

/**
 * Book metadata. GNT file names / OT codes and chapter counts follow the
 * MACULA repos (reference: ScriptureDiagrammer src/io/gnt.ts, ot.ts). GNT
 * chapter counts are the standard canon counts (MACULA Greek ships one file
 * per BOOK, so counts drive only the chapter picker / prefetch bounds).
 * Note macula-hebrew's one oddball file code: Hosea is upper-case "HOS".
 */

export interface BookInfo {
  testament: Testament;
  /** Canonical order within its testament (GNT 1-27, OT 1-39). */
  num: number;
  name: string;
  abbr: string;
  chapters: number;
  /** GNT: source file name. OT: file code used to build chapter file names. */
  file?: string;
  code?: string;
}

type GntRow = [num: number, name: string, file: string, abbr: string, chapters: number];
const GNT_ROWS: GntRow[] = [
  [1, 'Matthew', '01-matthew.xml', 'Mat', 28],
  [2, 'Mark', '02-mark.xml', 'Mrk', 16],
  [3, 'Luke', '03-luke.xml', 'Luk', 24],
  [4, 'John', '04-john.xml', 'Jhn', 21],
  [5, 'Acts', '05-acts.xml', 'Act', 28],
  [6, 'Romans', '06-romans.xml', 'Rom', 16],
  [7, '1 Corinthians', '07-1corinthians.xml', '1Co', 16],
  [8, '2 Corinthians', '08-2corinthians.xml', '2Co', 13],
  [9, 'Galatians', '09-galatians.xml', 'Gal', 6],
  [10, 'Ephesians', '10-ephesians.xml', 'Eph', 6],
  [11, 'Philippians', '11-philippians.xml', 'Php', 4],
  [12, 'Colossians', '12-colossians.xml', 'Col', 4],
  [13, '1 Thessalonians', '13-1thessalonians.xml', '1Th', 5],
  [14, '2 Thessalonians', '14-2thessalonians.xml', '2Th', 3],
  [15, '1 Timothy', '15-1timothy.xml', '1Ti', 6],
  [16, '2 Timothy', '16-2timothy.xml', '2Ti', 4],
  [17, 'Titus', '17-titus.xml', 'Tit', 3],
  [18, 'Philemon', '18-philemon.xml', 'Phm', 1],
  [19, 'Hebrews', '19-hebrews.xml', 'Heb', 13],
  [20, 'James', '20-james.xml', 'Jas', 5],
  [21, '1 Peter', '21-1peter.xml', '1Pe', 5],
  [22, '2 Peter', '22-2peter.xml', '2Pe', 3],
  [23, '1 John', '23-1john.xml', '1Jn', 5],
  [24, '2 John', '24-2john.xml', '2Jn', 1],
  [25, '3 John', '25-3john.xml', '3Jn', 1],
  [26, 'Jude', '26-jude.xml', 'Jud', 1],
  [27, 'Revelation', '27-revelation.xml', 'Rev', 22],
];

export const GNT_BOOKS: BookInfo[] = GNT_ROWS.map(([num, name, file, abbr, chapters]) => ({
  testament: 'gnt',
  num,
  name,
  abbr,
  chapters,
  file,
}));

type OtRow = [num: number, name: string, code: string, chapters: number, abbr: string];
const OT_ROWS: OtRow[] = [
  [1, 'Genesis', 'Gen', 50, 'Gen'],
  [2, 'Exodus', 'Exo', 40, 'Exo'],
  [3, 'Leviticus', 'Lev', 27, 'Lev'],
  [4, 'Numbers', 'Num', 36, 'Num'],
  [5, 'Deuteronomy', 'Deu', 34, 'Deu'],
  [6, 'Joshua', 'Jos', 24, 'Jos'],
  [7, 'Judges', 'Jdg', 21, 'Jdg'],
  [8, 'Ruth', 'Rut', 4, 'Rut'],
  [9, '1 Samuel', '1Sa', 31, '1Sa'],
  [10, '2 Samuel', '2Sa', 24, '2Sa'],
  [11, '1 Kings', '1Ki', 22, '1Ki'],
  [12, '2 Kings', '2Ki', 25, '2Ki'],
  [13, '1 Chronicles', '1Ch', 29, '1Ch'],
  [14, '2 Chronicles', '2Ch', 36, '2Ch'],
  [15, 'Ezra', 'Ezr', 10, 'Ezr'],
  [16, 'Nehemiah', 'Neh', 13, 'Neh'],
  [17, 'Esther', 'Est', 10, 'Est'],
  [18, 'Job', 'Job', 42, 'Job'],
  [19, 'Psalms', 'Psa', 150, 'Psa'],
  [20, 'Proverbs', 'Pro', 31, 'Pro'],
  [21, 'Ecclesiastes', 'Ecc', 12, 'Ecc'],
  [22, 'Song of Songs', 'Sng', 8, 'Sng'],
  [23, 'Isaiah', 'Isa', 66, 'Isa'],
  [24, 'Jeremiah', 'Jer', 52, 'Jer'],
  [25, 'Lamentations', 'Lam', 5, 'Lam'],
  [26, 'Ezekiel', 'Ezk', 48, 'Ezk'],
  [27, 'Daniel', 'Dan', 12, 'Dan'],
  [28, 'Hosea', 'HOS', 14, 'Hos'],
  [29, 'Joel', 'Jol', 4, 'Jol'],
  [30, 'Amos', 'Amo', 9, 'Amo'],
  [31, 'Obadiah', 'Oba', 1, 'Oba'],
  [32, 'Jonah', 'Jon', 4, 'Jon'],
  [33, 'Micah', 'Mic', 7, 'Mic'],
  [34, 'Nahum', 'Nam', 3, 'Nam'],
  [35, 'Habakkuk', 'Hab', 3, 'Hab'],
  [36, 'Zephaniah', 'Zep', 3, 'Zep'],
  [37, 'Haggai', 'Hag', 2, 'Hag'],
  [38, 'Zechariah', 'Zec', 14, 'Zec'],
  [39, 'Malachi', 'Mal', 3, 'Mal'],
];

export const OT_BOOKS: BookInfo[] = OT_ROWS.map(([num, name, code, chapters, abbr]) => ({
  testament: 'ot',
  num,
  name,
  abbr,
  chapters,
  code,
}));

export function booksOf(testament: Testament): BookInfo[] {
  return testament === 'gnt' ? GNT_BOOKS : OT_BOOKS;
}

export function bookInfo(testament: Testament, num: number): BookInfo | undefined {
  return booksOf(testament).find((b) => b.num === num);
}

/** macula-hebrew chapter file name, e.g. "01-Gen-001-lowfat.xml". */
export function otChapterFile(book: BookInfo, chapter: number): string {
  const nn = String(book.num).padStart(2, '0');
  const ccc = String(chapter).padStart(3, '0');
  return `${nn}-${book.code}-${ccc}-lowfat.xml`;
}
