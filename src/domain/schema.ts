import { z } from 'zod';

/**
 * The reading-domain model. Deliberately FLAT — no syntax graph, no
 * relations, no layout (ADR-0001). Adapters read only the `<w>` leaves of
 * MACULA Lowfat XML; the `<wg>` hierarchy is ignored.
 *
 * Vocabulary enums are broad and additive; consumers must degrade gracefully
 * on values they do not handle (same doctrine as the reference schema).
 */

export const TestamentSchema = z.enum(['gnt', 'ot']);
export type Testament = z.infer<typeof TestamentSchema>;

export const ReadingLanguageSchema = z.enum(['grc', 'hbo']);
export type ReadingLanguage = z.infer<typeof ReadingLanguageSchema>;

export const PartOfSpeechSchema = z.enum([
  'noun',
  'propernoun',
  'pronoun',
  'verb',
  'participle',
  'infinitive',
  'adjective',
  'adverb',
  'article',
  'preposition',
  'conjunction',
  'particle',
  'interjection',
  'numeral',
  'determiner',
  'unknown',
]);
export type PartOfSpeech = z.infer<typeof PartOfSpeechSchema>;

export const GrammaticalCaseSchema = z.enum([
  'nominative',
  'genitive',
  'dative',
  'accusative',
  'vocative',
]);
export const GenderSchema = z.enum(['masculine', 'feminine', 'neuter', 'common', 'both']);
export const NumberSchema = z.enum(['singular', 'dual', 'plural']);
export const PersonSchema = z.enum(['first', 'second', 'third']);
export const TenseSchema = z.enum([
  'present',
  'imperfect',
  'future',
  'aorist',
  'perfect',
  'pluperfect',
]);
export const VoiceSchema = z.enum(['active', 'middle', 'passive', 'middlepassive']);
export const MoodSchema = z.enum([
  'indicative',
  'subjunctive',
  'optative',
  'imperative',
  'infinitive',
  'participle',
]);
export const DegreeSchema = z.enum(['positive', 'comparative', 'superlative']);
/** Hebrew nominal state. */
export const StateSchema = z.enum(['absolute', 'construct', 'determined']);

export const MorphologySchema = z
  .object({
    case: GrammaticalCaseSchema.optional(),
    gender: GenderSchema.optional(),
    number: NumberSchema.optional(),
    person: PersonSchema.optional(),
    tense: TenseSchema.optional(),
    voice: VoiceSchema.optional(),
    mood: MoodSchema.optional(),
    degree: DegreeSchema.optional(),
    state: StateSchema.optional(),
    /**
     * Free-form extras without schema churn. Used for: `morph` (compact
     * source code, e.g. "V-IAI-3S"/"Ncfsa"), Hebrew `stem` (binyan), verb
     * `type` (qatal/wayyiqtol/…), `lang` ("A" marks Aramaic sections).
     */
    extra: z.record(z.string()).optional(),
  })
  .strict();
export type Morphology = z.infer<typeof MorphologySchema>;

export const ReadingTokenSchema = z.object({
  /** Stable per-token id from the source (`xml:id`), unique corpus-wide. */
  id: z.string(),
  sourceId: z.string(),
  testament: TestamentSchema,
  language: ReadingLanguageSchema,
  book: z.string(),
  bookNum: z.number().int().positive(),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
  /**
   * 1-based word position within the verse, from the source ref ("!N").
   * Hebrew is morpheme-segmented: morphemes of one written word SHARE a
   * wordIndex and are ordered by `subIndex`. Never dedupe by wordIndex.
   */
  wordIndex: z.number().int().positive(),
  /** 0-based position among tokens sharing (verse, wordIndex). */
  subIndex: z.number().int().nonnegative().default(0),
  /** The word as written (polytonic Greek / pointed Hebrew, verbatim). */
  surface: z.string(),
  /** Trailing separator from the source (`after`): space, punctuation, or
   *  absent — Hebrew prefixes join their host with no space. */
  after: z.string().optional(),
  lemma: z.string().optional(),
  /** Source-provided romanization (Hebrew only; Greek sources carry none). */
  transliteration: z.string().optional(),
  /** Token-level English gloss from the source (never a translation text). */
  gloss: z.string().optional(),
  /** Strong's number, digits with optional letter suffix, no G/H prefix. */
  strong: z.string().optional(),
  pos: PartOfSpeechSchema.optional(),
  morphology: MorphologySchema.optional(),
  /** The source's own reference string, e.g. "JHN 1:1!4" / "GEN 1:1!2". */
  sourceRef: z.string().optional(),
  /** Where the analysis came from. Adapters always emit 'given'. */
  provenance: z.enum(['given', 'converted']).default('given'),
});
export type ReadingToken = z.infer<typeof ReadingTokenSchema>;

export const ReadingVerseSchema = z.object({
  /** `${sourceId}:${book} ${chapter}:${verse}` — unique per source. */
  id: z.string(),
  /** Display reference, e.g. "John 1:1". */
  ref: z.string(),
  testament: TestamentSchema,
  language: ReadingLanguageSchema,
  book: z.string(),
  bookNum: z.number().int().positive(),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
  tokens: z.array(ReadingTokenSchema),
});
export type ReadingVerse = z.infer<typeof ReadingVerseSchema>;

export const ReadingChapterSchema = z.object({
  sourceId: z.string(),
  testament: TestamentSchema,
  language: ReadingLanguageSchema,
  book: z.string(),
  bookNum: z.number().int().positive(),
  chapter: z.number().int().positive(),
  verses: z.array(ReadingVerseSchema),
});
export type ReadingChapter = z.infer<typeof ReadingChapterSchema>;

/** A contiguous run of loaded chapters within one book (continuous scroll). */
export interface ReadingRange {
  sourceId: string;
  bookNum: number;
  startChapter: number;
  endChapter: number;
  chapters: ReadingChapter[];
}

/** Canonical verse reference for navigation/search results. */
export interface VerseRef {
  testament: Testament;
  bookNum: number;
  chapter: number;
  verse: number;
}
