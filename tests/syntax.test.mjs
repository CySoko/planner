import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url).pathname;
const dirs = ['js', 'js/views', 'apps-script'];

for (const dir of dirs) {
  const abs = join(ROOT, dir);
  const files = readdirSync(abs).filter(f => f.endsWith('.js')).sort();
  for (const file of files) {
    const rel = `${dir}/${file}`;
    test(`syntax: ${rel}`, () => {
      try {
        execFileSync(process.execPath, ['--check', join(abs, file)]);
      } catch (err) {
        throw new Error(err.stderr.toString());
      }
    });
  }
}
