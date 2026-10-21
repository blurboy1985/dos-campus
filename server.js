import http from 'node:http';
import {readFileSync, existsSync, mkdirSync, statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(root, 'public');
const dbPath = process.env.DB_PATH || path.join(root, 'data/campus.sqlite');
mkdirSync(path.dirname(dbPath), {recursive: true});

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS use_cases(id TEXT PRIMARY KEY, category TEXT NOT NULL, payload TEXT NOT NULL);');

// Seed once from seed.json; an existing database is never overwritten.
if (db.prepare('SELECT count(*) AS n FROM use_cases').get().n === 0) {
  const insert = db.prepare('INSERT INTO use_cases VALUES(?,?,?)');
  db.exec('BEGIN');
  try {
    for (const r of JSON.parse(readFileSync(path.join(root, 'data/seed.json'), 'utf8'))) {
      insert.run(r['Submission ID'], r['Primary category'], JSON.stringify(r));
    }
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'");
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.writeHead(405, {Allow: 'GET'});
    return res.end('Read-only API');
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    const json = v => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(v));
    };

    if (url.pathname === '/api/health') return json({ok: true});

    if (url.pathname === '/api/use-cases') {
      const records = db.prepare('SELECT payload FROM use_cases ORDER BY rowid').all().map(r => JSON.parse(r.payload));
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const cat = url.searchParams.get('category');
      return json(records.filter(r => (!cat || r['Primary category'] === cat) && (!q || JSON.stringify(r).toLowerCase().includes(q))));
    }

    if (url.pathname.startsWith('/api/use-cases/')) {
      const r = db.prepare('SELECT payload FROM use_cases WHERE id=?').get(decodeURIComponent(url.pathname.split('/').pop()));
      if (!r) {
        res.writeHead(404);
        return res.end('Not found');
      }
      return json(JSON.parse(r.payload));
    }

    if (url.pathname === '/api/departments') {
      return json(db.prepare('SELECT category, count(*) AS count FROM use_cases GROUP BY category').all());
    }

    // Static files, path-checked to block traversal out of public/.
    const relative = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
    const target = path.resolve(publicDir, decodeURIComponent(relative));
    if (!target.startsWith(publicDir + path.sep) || !existsSync(target) || !statSync(target).isFile()) {
      res.writeHead(404);
      return res.end('Not found');
    }
    res.setHeader('Content-Type', mime[path.extname(target)] || 'application/octet-stream');
    res.end(readFileSync(target));
  } catch (e) {
    res.writeHead(500);
    res.end('Server error');
    console.error(e);
  }
});

const host = process.env.HOST || '127.0.0.1';
const port = Number(process.env.PORT || 3000);
server.listen(port, host, () => console.log(`AI Campus listening on http://${host}:${port}`));
process.on('SIGTERM', () => server.close(() => {
  db.close();
  process.exit(0);
}));
