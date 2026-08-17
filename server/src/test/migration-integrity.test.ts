import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DRIZZLE_DIR = path.resolve(__dirname, '../../drizzle');
const JOURNAL_PATH = path.join(DRIZZLE_DIR, 'meta', '_journal.json');

describe('migration integrity', () => {
  it('registers every SQL migration in the Drizzle journal', () => {
    const migrationTags = fs
      .readdirSync(DRIZZLE_DIR)
      .filter((file) => /^\d{4}_.+\.sql$/.test(file))
      .map((file) => file.replace(/\.sql$/, ''))
      .sort();
    const journal = JSON.parse(fs.readFileSync(JOURNAL_PATH, 'utf8')) as {
      entries: Array<{ tag: string }>;
    };
    const journalTags = journal.entries.map((entry) => entry.tag).sort();

    expect(journalTags).toEqual(migrationTags);
  });
});
