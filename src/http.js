// Ajudantes de HTTP: responder JSON, ler o corpo do pedido e entregar os arquivos de public/.
const fs = require('fs'), path = require('path');

const PUB = path.join(__dirname, '..', 'public');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

const send = (r, c, o) => { r.writeHead(c, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };

const lerCorpo = async req => {
  let raw = ''; for await (const c of req) raw += c;
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
};

const arquivo = (p, res) => {
  const f = path.join(PUB, p === '/' ? 'index.html' : p);
  // startsWith(PUB) impede pedir arquivos fora de public/ (ex.: /../db.json)
  if (!f.startsWith(PUB) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('Página não encontrada'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
};

module.exports = { send, lerCorpo, arquivo };
