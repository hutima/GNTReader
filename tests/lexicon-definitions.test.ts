import { describe, expect, it } from 'vitest';
import { parseBdbDefinitions, parseDodsonTsv } from '@/io/lexiconDefinitions';

describe('supplemental lexicon definitions', () => {
  it('indexes Dodson brief and longer definitions by normalized Strong’s number', () => {
    const tsv = [
      '"Strong\'s"\t"Goodrick-Kohlenberger"\t"Greek Word"\t"English Definition (brief)"\t"English Definition (longer)"',
      '"0303"\t"0324"\t"a)na/"\t"and, apiece, by, each"\t"prep. Rare in NT; prop: upwards, up; as a prefix: up, to, anew, back."',
      '"2775"\t"3046"\t"kefalaio/w"\t"I sum up"\t"I sum up, gather up into one."',
    ].join('\n');

    const definitions = parseDodsonTsv(tsv);
    expect(definitions.get('303')).toEqual({
      brief: 'and, apiece, by, each',
      longer: 'prep. Rare in NT; prop: upwards, up; as a prefix: up, to, anew, back.',
    });
    expect(definitions.get('2775')?.longer).toBe('I sum up, gather up into one.');
  });

  it('uses the lexical-index Strong’s -> BDB crosswalk and keeps distinct BDB senses', () => {
    const lexical = `<?xml version="1.0"?>
      <index>
        <entry id="arn"><w>אֱלֹהִים</w><xref bdb="a.dl.ad" strong="430"/></entry>
      </index>`;
    const bdb = `<?xml version="1.0"?>
      <lexicon>
        <entry id="a.dl.ad">
          <w>אֱלֹהִים</w>
          <sense><def>rulers</def>, <def>judges</def></sense>
          <sense><def>divine ones</def>, <def>angels</def>, <def>gods</def></sense>
          <sense><def>God</def></sense>
          <sense><def>God</def></sense>
        </entry>
      </lexicon>`;

    expect(parseBdbDefinitions(lexical, bdb).get('430')).toBe(
      'rulers; judges; divine ones; angels; gods; God',
    );
  });

  it('respects augmented Hebrew Strong’s homographs rather than guessing a bare number', () => {
    const lexical = `<?xml version="1.0"?>
      <index>
        <entry id="a"><xref bdb="bdb.a" strong="441" aug="a"/></entry>
        <entry id="b"><xref bdb="bdb.b" strong="441" aug="b"/></entry>
        <entry id="c"><xref bdb="bdb.c" strong="500" aug="a"/></entry>
      </index>`;
    const bdb = `<?xml version="1.0"?>
      <lexicon>
        <entry id="bdb.a"><def>first homograph</def></entry>
        <entry id="bdb.b"><def>second homograph</def></entry>
        <entry id="bdb.c"><def>only augmented reading</def></entry>
      </lexicon>`;

    const definitions = parseBdbDefinitions(lexical, bdb);
    expect(definitions.get('441a')).toBe('first homograph');
    expect(definitions.get('441b')).toBe('second homograph');
    expect(definitions.has('441')).toBe(false);
    expect(definitions.get('500')).toBe('only augmented reading');
  });
});
