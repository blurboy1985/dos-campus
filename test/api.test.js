import {test, before, after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import http from 'node:http';

const base = 'http://127.0.0.1:3098';
const dir = mkdtempSync(path.join(tmpdir(), 'campus-test-'));
let child;

before(async () => {
  // Always test against the fictional sample, whatever real data is installed locally.
  child = spawn(process.execPath, ['server.js'], {env: {...process.env, PORT: '3098', DB_PATH: path.join(dir, 'test.sqlite'), SEED_PATH: path.resolve('data/seed.sample.json')}, stdio: 'pipe'});
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(base + '/api/health')).ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  throw new Error('Server did not start');
});

after(async () => {
  child.kill();
  await new Promise(r => child.once('exit', r));
  rmSync(dir, {recursive: true, force: true});
});

test('API preserves all records and seven departments', async () => {
  const records = await (await fetch(base + '/api/use-cases')).json();
  assert.equal(records.length, 86);
  assert.equal(new Set(records.map(r => r['Submission ID'])).size, 86);
  const departments = await (await fetch(base + '/api/departments')).json();
  assert.equal(departments.length, 7);
  assert.equal(departments.reduce((n, d) => n + d.count, 0), 86);
  const first = await (await fetch(base + '/api/use-cases/' + records[0]['Submission ID'])).json();
  assert.deepEqual(first, records[0]);
  assert.equal((await fetch(base + '/api/use-cases/no-such-id')).status, 404);
  assert.equal((await fetch(base + '/api/use-cases', {method: 'POST'})).status, 405);
});

test('category and text filters', async () => {
  const cat = 'Data Validation & Quality Assurance';
  const inCat = await (await fetch(base + '/api/use-cases?category=' + encodeURIComponent(cat))).json();
  assert.ok(inCat.length > 0);
  assert.ok(inCat.every(r => r['Primary category'] === cat));
  const all = await (await fetch(base + '/api/use-cases')).json();
  const term = all[0]['Submission ID'].toLowerCase();
  const hits = await (await fetch(base + '/api/use-cases?q=' + term)).json();
  assert.ok(hits.some(r => r['Submission ID'] === all[0]['Submission ID']));
});

test('serves the 2D page and its assets with security headers', async () => {
  const home = await fetch(base + '/');
  assert.equal(home.status, 200);
  assert.match(await home.text(), /DOS AI Campus 2D/);
  assert.match(home.headers.get('content-security-policy'), /script-src 'self';/);
  for (const [file, type] of [['/app.js', 'text/javascript'], ['/style.css', 'text/css']]) {
    const r = await fetch(base + file);
    assert.equal(r.status, 200, file);
    assert.match(r.headers.get('content-type'), new RegExp(type));
  }
});

test('blocks path traversal out of public/', async () => {
  // fetch() normalises "..", so send the raw path with node:http.
  for (const raw of ['/../server.js', '/..%2fserver.js', '/%2e%2e/package.json']) {
    const status = await new Promise((resolve, reject) => {
      http.get({host: '127.0.0.1', port: 3098, path: raw}, r => {
        r.resume();
        resolve(r.statusCode);
      }).on('error', reject);
    });
    assert.equal(status, 404, raw);
  }
});
