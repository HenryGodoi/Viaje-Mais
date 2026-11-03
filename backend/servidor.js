// Viaje Mais — servidor (Node 18+, sem dependências). Rodar na raiz do projeto: node server.js
// Este arquivo só liga as peças: entrega o frontend e os painéis do Dashboard, ou chama a rota da API. Mapa do backend: backend/README.md.
const http = require('http'), path = require('path');
const { PORTA, DASHBOARD } = require('./config');
const { send, lerCorpo, arquivo, comSeguranca } = require('./http');
const { lerSessao } = require('./sessoes');

// Cada rota: { metodo, caminho, quem, fazer }. quem: vazio = público, 'logado' = qualquer conta, ou um perfil.
// No caminho, :id vira número (id) e :nome vira texto (nome), por exemplo /api/operador/acoes/:nome.
const rotas = [...require('./rotas/conta'), ...require('./rotas/perfil'), ...require('./rotas/ofertas'), ...require('./rotas/operador'), ...require('./rotas/admin')]
  .map(r => ({ ...r, param: r.caminho.includes(':id') ? 'id' : r.caminho.includes(':nome') ? 'nome' : null,
    re: new RegExp('^' + r.caminho.replace(':id', '(\\d+)').replace(':nome', '([A-Za-z]+)') + '$') }));

// Painéis do Dashboard (outro repositório), entregues no mesmo endereço do site para o cookie de login valer lá.
// Os arquivos são públicos (não têm dados); os dados vêm das rotas /api/operador e /api/admin, que exigem login.
const PAINEIS = { '/admin': path.join(DASHBOARD, 'admin'), '/operador': path.join(DASHBOARD, 'operador') };

http.createServer(async (req, res) => {
  // Tudo dentro do try, inclusive a leitura do corpo: um erro num pedido (ou um envio cortado no meio,
  // como o de um celular que perde o sinal) nunca pode derrubar o servidor para todo mundo.
  try {
    comSeguranca(req, res);
    const p = new URL(req.url, 'http://x').pathname, m = req.method;
    if (!p.startsWith('/api/')) {
      const painel = Object.keys(PAINEIS).find(k => p === k || p.startsWith(k + '/'));
      if (p === painel) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
      return painel ? arquivo(p.slice(painel.length), res, PAINEIS[painel]) : arquivo(p, res);
    }

    let achou, rota = rotas.find(r => (r.metodo === '*' || r.metodo === m) && (achou = p.match(r.re)));
    if (!rota) return send(res, 404, { erro: 'Rota não encontrada.' });

    const { tok, me, sessao } = lerSessao(req);
    if (rota.quem && !me) return send(res, 401, { erro: 'Entre na sua conta para continuar.' });
    if (rota.quem && rota.quem !== 'logado' && me.perfil !== rota.quem) return send(res, 403, { erro: 'Você não tem permissão para isso.' });

    const b = await lerCorpo(req);
    const param = rota.param && { [rota.param]: rota.param === 'id' ? +achou[1] : achou[1] };
    await rota.fazer({ req, res, b, me, tok, sessao, ...param });
  } catch (e) {
    if (e.code === 'ECONNRESET' || res.headersSent) return; // a pessoa desconectou ou a resposta já saiu: não há o que responder
    if (e.status === 413) return send(res, 413, { erro: e.message });
    if (e.publico) return send(res, e.status, { erro: e.message }); // erro de regra de negócio, com a mensagem para a tela
    console.error(e); send(res, 500, { erro: 'Erro no servidor. Tente de novo.' });
  }
}).listen(PORTA, () => console.log('Viaje Mais em http://localhost:' + PORTA));
