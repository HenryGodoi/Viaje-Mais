// Ajudantes de HTTP: responder JSON, ler o corpo do pedido e entregar os arquivos de frontend/.
const fs = require('fs'), path = require('path');

const PUB = path.join(__dirname, '..', 'frontend');
const TIPOS = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

const send = (r, c, o) => { r.writeHead(c, { 'Content-Type': 'application/json' }); r.end(JSON.stringify(o)); };

// Pedido que chegou por HTTPS através de um túnel como o ngrok (ele avisa por este cabeçalho).
const viaHttps = req => req.headers['x-forwarded-proto'] === 'https';
// Cabeçalhos de segurança em toda resposta. A CSP só deixa carregar o que é do próprio site e as fontes do Google.
// 'unsafe-inline' em style-src porque as telas usam style="..."; data: em img-src por causa do QR do voucher.
// Se o frontend passar a usar outro site (CDN, mapa, Pix), ele precisa entrar aqui.
const SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};
const comSeguranca = (req, res) => {
  for (const [k, v] of Object.entries(SEGURANCA)) res.setHeader(k, v);
  if (viaHttps(req)) res.setHeader('Strict-Transport-Security', 'max-age=15552000'); // 180 dias: só HTTPS daqui pra frente
};

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

module.exports = { send, lerCorpo, arquivo, viaHttps, comSeguranca };
