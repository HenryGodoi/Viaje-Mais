// Viaje Mais — servidor (Node 18+, sem dependências). Rodar: node server.js
// Este arquivo só liga as peças. As regras ficam em src/ (veja o CLAUDE.md).
const http = require('http');
const { PORTA } = require('./src/config');
const { send, lerCorpo, arquivo } = require('./src/http');
const { lerSessao } = require('./src/sessoes');

// Cada rota: { metodo, caminho, quem, fazer }. quem: vazio = público, 'logado' = qualquer conta, ou um perfil.
const rotas = [...require('./src/rotas/conta'), ...require('./src/rotas/passeios'), ...require('./src/rotas/ofertas')]
  .map(r => ({ ...r, re: new RegExp('^' + r.caminho.replace(':id', '(\\d+)') + '$') }));

http.createServer(async (req, res) => {
  const p = new URL(req.url, 'http://x').pathname, m = req.method;
  if (!p.startsWith('/api/')) return arquivo(p, res);

  let id, rota = rotas.find(r => (r.metodo === '*' || r.metodo === m) && (id = p.match(r.re)));
  if (!rota) return send(res, 404, { erro: 'Rota não encontrada.' });

  const { tok, me } = lerSessao(req);
  if (rota.quem && !me) return send(res, 401, { erro: 'Entre na sua conta para continuar.' });
  if (rota.quem && rota.quem !== 'logado' && me.perfil !== rota.quem) return send(res, 403, { erro: 'Você não tem permissão para isso.' });

  // Um erro inesperado responde 500 em vez de derrubar o servidor inteiro.
  try { rota.fazer({ req, res, b: await lerCorpo(req), me, tok, id: id[1] && +id[1] }); }
  catch (e) { console.error(e); if (!res.headersSent) send(res, 500, { erro: 'Erro no servidor. Tente de novo.' }); }
}).listen(PORTA, () => console.log('Viaje Mais em http://localhost:' + PORTA));
