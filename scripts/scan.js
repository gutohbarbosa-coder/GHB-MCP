// Heuristic local scanner: reports only path, rule and count; never matched values.
import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
const root = resolve(process.argv[2] || new URL('..', import.meta.url).pathname);
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['google-token', /ya29\.[A-Za-z0-9_-]{12,}/g],
  ['github-token', /(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/g],
  ['aws-key', /(?:AKIA|ASIA)[A-Z0-9]{16}/g],
  ['jwt', /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['credential-assignment', /(?:GOOGLE_ACCESS_TOKEN|CLIENT_SECRET|REFRESH_TOKEN|API_KEY|PASSWORD)[ \t]*=[ \t]*[^\s#\n][^\n]*/g],
  ['private-host', /https?:\/\/(?:[^\s/]*\.)?(?:vercel\.app|upstash\.io|internal|localhost)(?:[/:\s]|$)/g]
];
let files = 0, findings = 0;
async function walk(dir) {
  for (const ent of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, ent.name), name = relative(root, path);
    if (ent.isSymbolicLink()) { console.error(name, 'symlink blocked'); findings++; continue; }
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules') continue;
      if (ent.name === '.git') { console.error(name, 'git history blocked'); findings++; continue; }
      await walk(path); continue;
    }
    if (/^\.env(?:\.|$)/.test(ent.name) && ent.name !== '.env.example') {
      console.error(name, 'local environment blocked'); findings++; continue;
    }
    files++;
    const text = await readFile(path, 'utf8');
    for (const [rule, regex] of rules) {
      const count = [...text.matchAll(regex)].length;
      if (count) { console.error(JSON.stringify({ file: name, rule, count })); findings += count; }
    }
  }
}
await walk(root);
console.log(JSON.stringify({ files, findings, scope: 'all files except node_modules', heuristic: true }));
process.exitCode = findings ? 1 : 0;
