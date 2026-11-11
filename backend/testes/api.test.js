// Testes da API. Rodar na raiz do projeto, com o Node que já vem instalado (sem instalar nada):
//   node --test backend/testes/api.test.js
// Sobem um servidor de verdade numa porta livre, com um banco novo numa pasta temporária (BANCO_DIR),
// então nunca tocam no banco-de-dados/db.json. Os testes rodam em ordem e um continua de onde o outro parou.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, execFileSync } = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');

const RAIZ = path.join(__dirname, '..', '..'), PASTA = fs.mkdtempSync(path.join(os.tmpdir(), 'viaje-mais-teste-'));
const PORTA = 3900 + Math.floor(Math.random() * 90), SITE = `http://localhost:${PORTA}`, SENHA = 'senha-de-teste-123';
const env = { ...process.env, BANCO_DIR: PASTA, PORT: String(PORTA), DASHBOARD_DIR: path.join(PASTA, 'sem-dashboard') };
const daquiA = horas => new Date(Date.now() + horas * 36e5).toISOString();
const dia = dias => new Date(Date.now() + dias * 864e5).toLocaleDateString('sv'); // AAAA-MM-DD, no fuso do computador

// Cada "pessoa" guarda o próprio cookie, como um navegador separado.
const pessoa = () => {
  let cookie = '';
  return async (metodo, caminho, corpo) => {
    const r = await fetch(SITE + caminho, { method: metodo, headers: { 'Content-Type': 'application/json', cookie }, body: corpo ? JSON.stringify(corpo) : undefined });
    const novo = r.headers.get('set-cookie');
    if (novo) cookie = novo.split(';')[0];
    return { status: r.status, corpo: await r.json().catch(() => null) };
  };
};
const visitante = pessoa(), turista = pessoa(), operador = pessoa(), admin = pessoa();
const ok = (r, status = 200) => { assert.equal(r.status, status, JSON.stringify(r.corpo)); return r.corpo; };
const reservar = async ofertaId => ok(await turista('POST', '/api/reservas', { ofertaId, pessoas: 1, nome: 'Ana Teste', telefone: '(55) 99999-0000' }), 201);
const minhaReserva = async id => ok(await turista('GET', '/api/reservas')).find(r => r.id === id);
const acaoOperador = (nome, dados) => operador('POST', '/api/operador/acoes/' + nome, dados);
const acaoAdmin = (nome, dados) => admin('POST', '/api/admin/acoes/' + nome, dados);

let servidor, ofertas; // ofertas: as 4 saídas de demonstração, da mais cedo para a mais tarde

before(async () => {
  // trocar-senha.js cria o banco de demonstração na pasta temporária e põe senhas conhecidas nas contas de teste.
  for (const email of ['admin@viajemais.com', 'operador@viajemais.com']) execFileSync(process.execPath, ['backend/trocar-senha.js', email, SENHA], { cwd: RAIZ, env });
  servidor = spawn(process.execPath, ['server.js'], { cwd: RAIZ, env, stdio: 'ignore' });
  for (let i = 0; i < 50 && !ofertas; i++) {
    await new Promise(r => setTimeout(r, 100));
    ofertas = await fetch(SITE + '/api/ofertas').then(r => r.json()).catch(() => null);
  }
  assert.ok(ofertas, 'o servidor de teste não ligou');
  ok(await admin('POST', '/api/login', { email: 'admin@viajemais.com', senha: SENHA }));
  ok(await operador('POST', '/api/login', { email: 'operador@viajemais.com', senha: SENHA }));
  ok(await turista('POST', '/api/cadastro', { nome: 'Ana Teste', email: 'ana@teste.com', senha: SENHA, confirmar: SENHA }), 201);
});
after(() => { servidor?.kill(); fs.rmSync(PASTA, { recursive: true, force: true }); });

test('ofertas abrem sem login, com os detalhes do passeio; reservar pede login', async () => {
  assert.equal(ofertas.length, 4);
  const o = ofertas[0];
  assert.ok(o.fotos.length <= 1, 'na lista vem só a capa');
  assert.deepEqual([o.destaque, o.acessivel, o.nota, o.avaliacoes, typeof o.duracaoMin], [false, false, null, 0, 'number']);
  const d = ok(await visitante('GET', '/api/ofertas/' + o.id));
  assert.deepEqual([d.horasCancelar, d.fechada, d.parceiro.nome, d.obsCancelamento, d.inclui, d.lat], [3, false, 'Parceiro Demo', null, null, null]);
  assert.deepEqual(d.idiomas, ['Português']);
  assert.ok(d.fotos.length > 1, 'no detalhe vêm todas as fotos');
  assert.equal((await visitante('POST', '/api/reservas', { ofertaId: o.id, pessoas: 1, nome: 'Ana', telefone: '55999990000' })).status, 401);
});

test('a reserva guarda as observações e o prazo de cancelamento que valia quando foi feita', async () => {
  const o = ofertas[0];
  ok(await acaoOperador('salvarPerfil', { campos: { telefone: '(55) 3222-0000' } }));
  const a = ok(await turista('POST', '/api/reservas', { ofertaId: o.id, pessoas: 1, nome: 'Ana Teste', telefone: '(55) 99999-0000', observacoes: 'x'.repeat(400) }), 201);
  assert.deepEqual([a.observacoes.length, a.horasCancelar, a.telefoneParceiro, a.passeioId], [300, 3, '(55) 3222-0000', o.passeioId]);
  assert.deepEqual(a.avisos, []);
  const noPainel = ok(await operador('GET', '/api/operador/painel')).reservas.find(r => r.id === a.id);
  assert.equal(noPainel.observacoes.length, 300);

  // O parceiro muda o prazo para 48 h: vale para as reservas novas, não para a que já existe.
  assert.equal((await acaoOperador('salvarPasseio', { id: o.passeioId, campos: { horas_cancelar: 7 } })).status, 400);
  ok(await acaoOperador('salvarPasseio', { id: o.passeioId, campos: { horas_cancelar: 48, acessivel: true, inclui: 'Guia, 1,5 litro de água; lanche' } }));
  const d = ok(await visitante('GET', '/api/ofertas/' + o.id));
  assert.deepEqual([d.horasCancelar, d.acessivel], [48, true]);
  assert.deepEqual(d.inclui, ['Guia', '1,5 litro de água', 'lanche']);
  ok(await acaoOperador('publicarOfertas', { passeio_id: o.passeioId, inicios: [daquiA(30)], vagas: 5, preco: 40, desconto_max: 20 }));
  const nova = ok(await visitante('GET', '/api/ofertas')).find(x => x.passeioId === o.passeioId && x.id !== o.id);
  const b = await reservar(nova.id);
  assert.equal(b.horasCancelar, 48);
  const recusa = await turista('POST', `/api/reservas/${b.id}/cancelar`);
  assert.equal(recusa.status, 409);
  assert.match(recusa.corpo.erro, /48 horas/);
  const cancelada = ok(await turista('POST', `/api/reservas/${a.id}/cancelar`)); // a antiga segue com 3 h
  assert.deepEqual([cancelada.status, cancelada.avisos.length], ['cancelada', 0]);
});

test('o que o admin muda na reserva vira aviso para o turista, e a anotação interna não vaza', async () => {
  const o = ofertas[1], c = await reservar(o.id);
  ok(await acaoOperador('publicarOfertas', { passeio_id: o.passeioId, inicios: [daquiA(6 * 24)], vagas: 5, preco: 90, desconto_max: 20 }));
  const outra = ok(await admin('GET', '/api/admin/painel')).ofertas.find(x => x.passeio_id === o.passeioId && x.id !== o.id);
  ok(await acaoAdmin('enviarMensagem', { para: 'turista', id: c.id, assunto: 'Ponto de encontro', texto: 'Chegue 10 minutos antes.' }));
  ok(await acaoAdmin('reemitirVoucher', { id: c.id }));
  ok(await acaoAdmin('remarcarReserva', { id: c.id, oferta_id: outra.id }));
  let r = await minhaReserva(c.id);
  assert.deepEqual(r.avisos.map(x => x.tipo), ['mensagem', 'voucher_reemitido', 'remarcada']);
  assert.deepEqual([r.avisos[0].texto, r.avisos[0].assunto], ['Chegue 10 minutos antes.', 'Ponto de encontro']);
  assert.deepEqual([r.avisos[2].deData, r.avisos[2].paraData, r.inicio], [o.inicio, outra.inicio, outra.inicio]);
  assert.notEqual(r.codigo, c.codigo);
  assert.equal(new Set(r.avisos.map(x => x.id)).size, 3, 'cada aviso tem o seu id');

  assert.equal(ok(await acaoAdmin('cancelarReserva', { id: c.id, motivo: 'cancelada_clima', obs: 'Anotação interna da equipe' })).devolve, true);
  r = await minhaReserva(c.id);
  const aviso = r.avisos.at(-1);
  assert.deepEqual([r.status, r.motivoCancelamento, aviso.tipo], ['cancelada', 'Cancelado por clima', 'cancelada']);
  assert.match(aviso.texto, /clima\. Não há nada a pagar\.$/);
  assert.ok(!JSON.stringify(r).includes('Anotação interna'), 'o turista não lê a anotação do admin');
  assert.equal(ok(await admin('GET', '/api/admin/painel')).reservas.find(x => x.id === c.id).cancelado_obs, 'Anotação interna da equipe');
});

test('passeio que sai do ar: as reservas só são canceladas quando pedem; senão continuam valendo', async () => {
  const d = await reservar(ofertas[2].id), e = await reservar(ofertas[3].id);
  assert.equal(ok(await acaoOperador('ocultarPasseio', { id: ofertas[2].passeioId, oculto: true, cancelar_reservas: true })).canceladas, 1);
  const cancelada = await minhaReserva(d.id);
  assert.equal(cancelada.status, 'cancelada');
  assert.match(cancelada.avisos[0].texto, /não está mais disponível\. Não há nada a pagar\.$/);
  assert.equal((await visitante('GET', '/api/ofertas/' + ofertas[2].id)).status, 404);
  assert.equal(ok(await turista('GET', '/api/ofertas/' + ofertas[2].id)).fechada, true);

  // Suspensão por um motivo que não impede o passeio: sai da vitrine, mas quem reservou mantém a reserva.
  const parceiro = ok(await operador('GET', '/api/operador/painel')).parceiro.id;
  assert.equal(ok(await acaoAdmin('suspenderParceiro', { id: parceiro, motivo: 'Documento atrasado' })).canceladas, 0);
  assert.deepEqual(ok(await visitante('GET', '/api/ofertas')), []);
  assert.equal((await minhaReserva(e.id)).status, 'reservada');
  assert.equal(ok(await turista('GET', '/api/ofertas/' + ofertas[3].id)).fechada, true);
  ok(await acaoAdmin('reativarParceiro', { id: parceiro, motivo: 'Documento entregue' }));
  assert.ok(ok(await visitante('GET', '/api/ofertas')).length > 0);
});

test('destaque pago vem primeiro e vai para o hero; a nota do passeio é pública', async () => {
  const o = ofertas[3]; // a saída mais tarde de todas
  ok(await acaoAdmin('destacarPasseio', { id: o.passeioId, inicio: dia(0), fim: dia(10) }));
  const lista = ok(await visitante('GET', '/api/ofertas')), destaques = ok(await visitante('GET', '/api/destaques'));
  assert.deepEqual([lista[0].id, lista[0].destaque, lista[1].destaque], [o.id, true, false]);
  assert.deepEqual([destaques.length, destaques[0].id, typeof destaques[0].foto], [1, o.id, 'string']);
  assert.ok(!JSON.stringify(destaques).includes('valor'), 'o valor pago pelo destaque não vai para o site');

  const e = ok(await turista('GET', '/api/reservas')).find(r => r.ofertaId === o.id);
  assert.equal(ok(await operador('POST', '/api/operador/validar', { codigo: e.codigo, forcar: true })).tipo, 'liberada');
  ok(await turista('POST', `/api/reservas/${e.id}/avaliar`, { nota: 4, comentario: 'Muito bom' }), 201);
  const usada = await minhaReserva(e.id);
  assert.deepEqual([usada.status, usada.pessoasChegaram, usada.telefoneParceiro], ['usada', 1, '(55) 3222-0000']);
  const av = ok(await visitante('GET', `/api/passeios/${o.passeioId}/avaliacoes`));
  assert.deepEqual([av.nota, av.avaliacoes, av.lista[0].nome, av.lista[0].comentario], [4, 1, 'Ana', 'Muito bom']);
  assert.equal(ok(await visitante('GET', '/api/ofertas/' + o.id)).nota, 4);
});

test('envio grande demais é recusado sem derrubar o servidor', async () => {
  const envio = kb => fetch(SITE + '/api/login', { method: 'POST', body: 'x'.repeat(kb * 1024) }).then(r => r.status, () => 'conexão cortada');
  assert.equal(await envio(500), 413);
  assert.ok([413, 'conexão cortada'].includes(await envio(5000)));
  assert.equal((await visitante('GET', '/api/vitrine')).status, 200);
});
