import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function fixtureXml(rel: string): string {
  return readFileSync(join(__dirname, '..', 'public', 'fixtures', rel), 'utf8');
}
