// Ajudantes de HTTP: responder JSON, ler o corpo do pedido e entregar os arquivos de frontend/.
const fs = require('fs'), path = require('path');

const PUB = path.join(__dirname, '..', 'frontend');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png' };

const send = (r, c, o) => { r.writeHead(c, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };

// Corpo do pedido em JSON. Acima de 400 KB (contados em bytes) dá erro 413;
// a foto de perfil, já reduzida no navegador, fica bem abaixo disso.
const LIMITE = 400 * 1024;
const lerCorpo = async req => {
  const pedacos = []; let bytes = 0;
  // Lê até o fim mesmo passando do limite: parar no meio fecharia a conexão antes de dar a resposta 413.
  for await (const c of req) { bytes += c.length; if (bytes <= LIMITE) pedacos.push(c); }
  if (bytes > LIMITE) throw Object.assign(new Error('O envio passou do tamanho permitido.'), { status: 413 });
  // Junta os bytes antes de virar texto: um acento cortado entre dois pedaços não se corrompe.
  try { const b = JSON.parse(Buffer.concat(pedacos).toString('utf8') || '{}'); return b && typeof b === 'object' ? b : {}; }
  catch { return {}; }
};

const arquivo = (p, res) => {
  const f = path.join(PUB, p === '/' ? 'index.html' : p);
  // startsWith(PUB) impede pedir arquivos fora de frontend/ (ex.: /../banco-de-dados/db.json)
  if (!f.startsWith(PUB) || !fs.existsSync(f) || !fs.statSync(f).isFile()) { res.writeHead(404); return res.end('Página não encontrada'); }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(f)] || 'text/plain', 'Cache-Control': 'no-cache' });
  fs.createReadStream(f).pipe(res);
};

module.exports = { send, lerCorpo, arquivo };
