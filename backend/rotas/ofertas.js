// Rotas do site do turista: vitrine da home, ofertas, reservas, cancelamento e avaliação.
// Respondem no formato de sempre do site (camelCase); os painéis do Dashboard usam rotas/operador.js e rotas/admin.js.
// Ver as ofertas não pede login (decisão do Henry de 03/11/2026); reservar, sim.
const { db, save } = require('../banco');
const { HORAS_CANCELAR, COM_LOCAL } = require('../config');
const { cod } = require('../seguranca');
const { iso, r2, texto, telefoneValido, nomeCategoria, novaReserva } = require('../modelo');
const { falta, livres, pct, visivel, vis, detalhe, rvis, cancelar, parceiroDe, passeioDe, avaliacoesDe, media, notaDe, ou } = require('../regras');
const { send } = require('../http');

// Ofertas que o viajante pode reservar: visíveis, horário futuro e vaga livre. Mais cedo primeiro.
const abertas = (filtro = () => true) => db.ofertas.filter(o => filtro(o) && visivel(o) && falta(o) > 0 && livres(o) > 0).map(vis).sort((a, c) => a.inicio.localeCompare(c.inicio));
const respostaDe = a => a.resposta ? { texto: a.resposta.texto, quando: a.resposta.editado_em || a.resposta.criado_em } : null;

module.exports = [
  // Próximas saídas para o quadro da home, só por horário. Só o necessário, sem operador nem descrição.
  { metodo: 'GET', caminho: '/api/vitrine', fazer: ({ res }) =>
    send(res, 200, abertas().slice(0, 4).map(o => ({ id: o.id, inicio: o.inicio, titulo: o.titulo, cidade: o.cidade, livres: o.livres, vagas: o.vagas, desconto: o.desconto, ultimaHora: o.ultimaHora }))) },
  // Passeios com destaque pago, para o hero da home: a próxima saída com vaga de cada um. O valor pago não vai.
  { metodo: 'GET', caminho: '/api/destaques', fazer: ({ res }) => {
    const vistos = new Set();
    send(res, 200, abertas().filter(o => o.destaque && !vistos.has(o.passeioId) && vistos.add(o.passeioId)).map(o => ({ id: o.id, passeioId: o.passeioId, inicio: o.inicio,
      titulo: o.titulo, cidade: o.cidade, categoria: o.categoria, foto: o.fotos[0] || null, livres: o.livres, vagas: o.vagas, precoNormal: o.precoNormal,
      precoFinal: o.precoFinal, desconto: o.desconto, ultimaHora: o.ultimaHora, nota: o.nota, avaliacoes: o.avaliacoes })));
  } },
  // Lista de ofertas: os destaques pagos primeiro e, dentro de cada grupo, a saída mais cedo (a ordenação mantém a ordem de quem empata).
  { metodo: 'GET', caminho: '/api/ofertas', fazer: ({ res }) => send(res, 200, abertas().sort((a, c) => c.destaque - a.destaque)) },
  // Página da oferta. A que saiu do ar só abre para quem está logado e tem reserva nela (vem com fechada: true).
  { metodo: 'GET', caminho: '/api/ofertas/:id', fazer: ({ res, id, me }) => {
    const o = db.ofertas.find(x => x.id === id);
    if (!o || !(visivel(o) || (me && db.reservas.some(r => r.oferta_id === o.id && r.turista_id === me.id)))) return send(res, 404, { erro: 'Oferta não encontrada.' });
    send(res, 200, detalhe(o));
  } },
  // O que os outros viajantes acharam do passeio: só o primeiro nome, sem as avaliações removidas. Mais novas primeiro.
  { metodo: 'GET', caminho: '/api/passeios/:id/avaliacoes', fazer: ({ res, id }) => {
    if (passeioDe(id)?.status !== 'ativo') return send(res, 404, { erro: 'Passeio não encontrado.' });
    send(res, 200, { ...notaDe(id), lista: avaliacoesDe(id).map(a => ({ id: a.id, nome: a.turista_nome, nota: a.nota, comentario: ou(a.comentario), quando: a.criado_em,
      resposta: respostaDe(a) })).reverse() });
  } },
  // Página pública do parceiro. Endereço e horário só de quem tem local de atendimento; telefone, e-mail, documento e Pix nunca vão.
  { metodo: 'GET', caminho: '/api/parceiros/:id', fazer: ({ res, id }) => {
    const pr = parceiroDe(id);
    if (pr?.status !== 'ativo') return send(res, 404, { erro: 'Parceiro não encontrado.' });
    const comLocal = COM_LOCAL.includes(pr.categoria);
    send(res, 200, { id: pr.id, nome: pr.nome, foto: pr.foto || null, categoria: nomeCategoria(pr.categoria), cidade: ou(pr.cidade), endereco: comLocal ? ou(pr.endereco) : null,
      horario: comLocal ? ou(pr.horario) : null, cadastur: !!pr.cadastur, ...media(db.avaliacoes.filter(a => a.parceiro_id === pr.id && !a.removida)),
      ofertas: abertas(o => o.parceiro_id === pr.id) });
  } },

  // Viajante
  { metodo: 'POST', caminho: '/api/reservas', quem: 'cliente', fazer: ({ res, me, b }) => {
    const o = db.ofertas.find(x => x.id === +b.ofertaId), q = +b.pessoas;
    if (!o || !visivel(o) || falta(o) <= 0) return send(res, 404, { erro: 'Esta oferta não está mais disponível.' });
    if (!Number.isInteger(q) || q < 1 || q > 10) return send(res, 400, { erro: 'Escolha de 1 a 10 pessoas.' });
    if (String(b.nome || '').trim().length < 2 || !telefoneValido(b.telefone)) return send(res, 400, { erro: 'Informe seu nome e um telefone com DDD.' });
    const l = livres(o);
    if (l < q) return send(res, 409, { erro: l ? `Restam só ${l} vaga(s) nesta oferta.` : 'As vagas acabaram enquanto você reservava. Veja outras ofertas.' });
    // Preço, comissão e prazo de cancelamento travados no momento da reserva: mudanças depois não alteram esta reserva.
    const d = pct(o), unit = r2(o.preco * (1 - d / 100)), valor_pago = r2(unit * q), comissao_pct = parceiroDe(o.parceiro_id).comissao_pct, comissao = r2(valor_pago * comissao_pct);
    let codigo; do codigo = cod(); while (db.reservas.some(x => x.codigo === codigo));
    const agora = iso(), pa = passeioDe(o.passeio_id);
    const r = novaReserva({ id: db.seq++, codigo, oferta_id: o.id, passeio_id: o.passeio_id, parceiro_id: o.parceiro_id, turista_id: me.id,
      nome: texto(b.nome, 80), telefone: texto(b.telefone, 30), observacoes: texto(b.observacoes, 300), pessoas: q, preco_unit: o.preco, valor_cheio: r2(o.preco * q),
      desconto_pct: d, valor_pago, comissao_pct, comissao, valor_parceiro: r2(valor_pago - comissao),
      horas_cancelar: pa.horas_cancelar ?? HORAS_CANCELAR, inclui: pa.inclui, levar: pa.levar, regras_cancelamento: pa.regras_cancelamento, criado_em: agora, voucher_emitido_em: agora });
    db.reservas.push(r); save(); send(res, 201, rvis(r));
  } },
  { metodo: 'GET', caminho: '/api/reservas', quem: 'cliente', fazer: ({ res, me }) => send(res, 200, db.reservas.filter(r => r.turista_id === me.id).map(rvis).reverse()) },
  // As avaliações que a pessoa fez. removida = o Viaje Mais tirou depois de uma denúncia (o motivo é escrito para o parceiro e não vai).
  { metodo: 'GET', caminho: '/api/avaliacoes', quem: 'cliente', fazer: ({ res, me }) => send(res, 200, db.avaliacoes.filter(a => a.turista_id === me.id).map(a => ({ id: a.id,
    reservaId: a.reserva_id, passeioId: a.passeio_id, titulo: passeioDe(a.passeio_id)?.titulo, nota: a.nota, comentario: ou(a.comentario), quando: a.criado_em,
    resposta: respostaDe(a), removida: !!a.removida })).reverse()) },
  { metodo: 'POST', caminho: '/api/reservas/:id/cancelar', quem: 'cliente', fazer: ({ res, me, id }) => {
    const r = db.reservas.find(x => x.id === id && x.turista_id === me.id), o = db.ofertas.find(x => x.id === r?.oferta_id);
    if (!r) return send(res, 404, { erro: 'Reserva não encontrada.' });
    if (r.status !== 'confirmada') return send(res, 409, { erro: 'Esta reserva não pode mais ser cancelada.' });
    const horas = r.horas_cancelar ?? HORAS_CANCELAR; // o prazo que valia quando a reserva foi feita
    if (falta(o) < horas) return send(res, 409, { erro: `O cancelamento é possível até ${horas} horas antes do passeio.` });
    cancelar(r, 'cancelada_turista', 'Cancelada pelo viajante', true); save(); send(res, 200, rvis(r));
  } },
  // Avaliação: depois de o voucher ser validado no local, uma vez por reserva. Aparece no painel do parceiro.
  { metodo: 'POST', caminho: '/api/reservas/:id/avaliar', quem: 'cliente', fazer: ({ res, me, id, b }) => {
    const r = db.reservas.find(x => x.id === id && x.turista_id === me.id), nota = +b.nota, comentario = texto(b.comentario, 600);
    if (!r) return send(res, 404, { erro: 'Reserva não encontrada.' });
    if (r.status !== 'validada') return send(res, 409, { erro: 'Dá para avaliar depois de fazer o passeio.' });
    if (db.avaliacoes.some(a => a.reserva_id === r.id)) return send(res, 409, { erro: 'Você já avaliou este passeio.' });
    if (!Number.isInteger(nota) || nota < 1 || nota > 5) return send(res, 400, { erro: 'Dê uma nota de 1 a 5.' });
    db.avaliacoes.push({ id: db.seq++, parceiro_id: r.parceiro_id, passeio_id: r.passeio_id, reserva_id: r.id, turista_id: me.id, turista_nome: String(me.nome).split(' ')[0],
      nota, comentario, com_desconto: r.desconto_pct > 0, desconto_pct: r.desconto_pct, resposta: null, denuncia: null, criado_em: iso() });
    save(); send(res, 201, { ok: true });
  } },
];
