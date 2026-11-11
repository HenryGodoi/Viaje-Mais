// Regras de negócio: vagas e desconto dinâmico, cancelamento, repasse semanal e como os registros aparecem para as telas.
const { db } = require('./banco');
const { HORAS_ULTIMA, HORAS_CANCELAR, OPCOES_CANCELAR, DESTAQUE_MENSAL, CATEGORIAS } = require('./config');
const { iso, r2, ymd, texto, nomeCategoria, ehCategoria, ehCidade, nomeCurto } = require('./modelo');
const { assinar } = require('./voucher');

const DIA = 864e5;
const passeioDe = id => db.passeios.find(p => p.id === id);
const parceiroDe = id => db.parceiros.find(p => p.id === id);
const ofertaDe = id => db.ofertas.find(o => o.id === id);

const falta = o => (Date.parse(o.inicio) - Date.now()) / 36e5; // horas até o início
const ativa = r => !r.status.startsWith('cancelada');
// shortcut: soma as reservas a cada consulta; com milhares de reservas, guardar a contagem na oferta.
const ocupadas = o => db.reservas.reduce((s, r) => r.oferta_id === o.id && ativa(r) ? s + r.pessoas : s, 0);
const livres = o => Math.max(0, o.vagas - ocupadas(o));
// Desconto dinâmico: quanto mais vazio o horário, maior o desconto; na última hora vai ao máximo; depois do início, zero.
const pct = o => { const l = livres(o), h = falta(o); return l <= 0 || h <= 0 ? 0 : h <= HORAS_ULTIMA ? o.desconto_max : Math.round(o.desconto_max * l / o.vagas); };

// Oferta que aparece no site: saída ativa, passeio aprovado e visível, parceiro ativo.
const visivel = o => { const pa = passeioDe(o.passeio_id); return o.status === 'ativa' && pa?.status === 'ativo' && !pa.oculto && parceiroDe(o.parceiro_id)?.status === 'ativo'; };
const fotosUrl = pa => { const f = (pa.fotos || []).filter(x => x.url), capa = f.find(x => x.id === pa.capa_id); return (capa ? [capa, ...f.filter(x => x !== capa)] : f).map(x => x.url); };

// Destaque pago que vale hoje, e a nota pública do passeio (as avaliações removidas pelo admin não contam).
const destaqueAtivo = (passeio_id, hoje = ymd(Date.now())) => db.destaques.find(d => d.passeio_id === passeio_id && d.inicio <= hoje && hoje <= d.fim);
const avaliacoesDe = passeio_id => db.avaliacoes.filter(a => a.passeio_id === passeio_id && !a.removida);
const notaDe = passeio_id => { const l = avaliacoesDe(passeio_id); return { nota: l.length ? Math.round(l.reduce((s, a) => s + a.nota, 0) / l.length * 10) / 10 : null, avaliacoes: l.length }; };

// Para o site, texto vazio e lista vazia vão como null: a tela esconde a linha com um teste só.
const ou = v => v === '' || v == null ? null : v;
// "Água, lanche; protetor" vira lista. A vírgula só separa quando vem seguida de espaço, para não quebrar "1,5 litro".
const lista = v => { const l = String(v || '').split(/[;\n]|,\s/).map(x => x.trim()).filter(Boolean); return l.length ? l : null; };
const local = pa => { const tem = Number.isFinite(pa?.lat) && Number.isFinite(pa?.lng); return { lat: tem ? pa.lat : null, lng: tem ? pa.lng : null }; };

// Oferta e reserva no formato que o site usa (camelCase). Só entram dados públicos: nada de comissão, Pix ou valor do destaque.
// vis = a oferta na lista (só a capa, porque a foto enviada pelo parceiro fica dentro do JSON e pesa); detalhe = a página da oferta.
const vis = o => {
  const pa = passeioDe(o.passeio_id), d = pct(o), l = livres(o);
  return { id: o.id, passeioId: o.passeio_id, inicio: o.inicio, vagas: o.vagas, livres: l, descontoMax: o.desconto_max, titulo: pa.titulo, cidade: pa.cidade,
    categoria: nomeCategoria(pa.categoria), descricao: pa.descricao, fotos: fotosUrl(pa).slice(0, 1), operador: parceiroDe(o.parceiro_id)?.nome, precoNormal: o.preco,
    desconto: d, precoFinal: r2(o.preco * (1 - d / 100)), ultimaHora: l > 0 && falta(o) > 0 && falta(o) <= HORAS_ULTIMA,
    duracaoMin: pa.duracao_min, acessivel: !!pa.acessivel, destaque: !!destaqueAtivo(pa.id), ...notaDe(pa.id) };
};
// fechada = saiu do ar (pausada, cancelada, passeio oculto ou parceiro suspenso); só quem já tem reserva nela ainda consegue abrir.
const detalhe = o => {
  const pa = passeioDe(o.passeio_id), pr = parceiroDe(o.parceiro_id);
  return { ...vis(o), fotos: fotosUrl(pa), pontoEncontro: ou(pa.ponto_encontro), ...local(pa), inclui: lista(pa.inclui), levar: lista(pa.levar), idiomas: lista(pa.idiomas),
    acessibilidade: ou(pa.acessibilidade), responsavel: ou(o.responsavel || pa.responsavel), horasCancelar: pa.horas_cancelar ?? HORAS_CANCELAR,
    obsCancelamento: ou(pa.regras_cancelamento), fechada: !visivel(o),
    parceiro: { id: pr.id, nome: pr.nome, foto: pr.foto || null, categoria: nomeCategoria(pr.categoria), cidade: ou(pr.cidade) } };
};

// Avisos que o turista lê na reserva: o que o parceiro ou o Viaje Mais mudou nela. Saem do que a reserva já guarda
// (o cancelamento e a linha do tempo), então o id de cada aviso não muda e o aparelho sabe quais a pessoa já viu.
const AVISO = { 'Remarcada': 'remarcada', 'Voucher reemitido': 'voucher_reemitido', 'Mensagem ao turista': 'mensagem' };
const ROTULO_CANCELAMENTO = { cancelada_turista: 'Pedido do turista', cancelada_parceiro: 'Cancelado pelo parceiro', cancelada_clima: 'Cancelado por clima' };
const avisos = r => {
  const l = [];
  r.historico.forEach((h, i) => {
    const tipo = AVISO[h.titulo], base = { id: `h${r.id}_${i}`, tipo, quando: h.quando };
    if (tipo === 'remarcada') l.push({ ...base, texto: `Sua reserva foi remarcada. ${h.texto}.`, deData: h.de || null, paraData: h.para || null });
    else if (tipo === 'voucher_reemitido') l.push({ ...base, texto: 'Seu voucher ganhou um código novo. O código e o QR antigos não valem mais.' });
    else if (tipo) l.push({ ...base, texto: h.texto, assunto: h.assunto || null });
  });
  if (r.status === 'cancelada_parceiro' || r.status === 'cancelada_clima') {
    const saida = ofertaDe(r.oferta_id)?.status === 'cancelada';
    // O nome fixo do motivo ("Cancelado por clima") já está dito na frase; só o texto que alguém escreveu entra depois dos dois-pontos.
    const motivo = Object.values(ROTULO_CANCELAMENTO).includes(r.cancelado_motivo) ? '' : String(r.cancelado_motivo || '').replace(/[.\s]+$/, '');
    const frase = saida ? 'Esta saída foi cancelada' : r.status === 'cancelada_clima' ? 'Sua reserva foi cancelada por causa do clima' : 'Sua reserva foi cancelada';
    const dinheiro = r.status_pagamento === 'estornado' ? `O valor de R$ ${r.reembolso.toFixed(2).replace('.', ',')} vai ser devolvido.` : 'Não há nada a pagar.';
    l.push({ id: `c${r.id}`, tipo: saida ? 'saida_cancelada' : 'cancelada', quando: r.cancelado_em, texto: `${frase}${motivo ? ': ' + motivo : ''}. ${dinheiro}` });
  }
  return l.sort((a, b) => String(a.quando).localeCompare(String(b.quando)));
};

const STATUS_SITE = { confirmada: 'reservada', validada: 'usada', no_show: 'no_show' }; // as canceladas viram 'cancelada'
const dadosDoQr = r => {
  const o = ofertaDe(r.oferta_id), pa = passeioDe(r.passeio_id);
  return { c: r.codigo, p: r.parceiro_id, i: o?.inicio, d: pa?.duracao_min, n: r.pessoas, t: nomeCurto(r.nome), s: pa?.titulo, e: r.voucher_emitido_em };
};
const rvis = r => {
  const o = ofertaDe(r.oferta_id), pa = passeioDe(r.passeio_id), pr = parceiroDe(r.parceiro_id);
  // Telefone do parceiro: só para quem reservou, e some no dia seguinte ao passeio (para não virar um contato permanente).
  const comTelefone = r.status === 'confirmada' || Date.now() < somaDias(meiaNoite(o?.inicio), 1);
  return { id: r.id, ofertaId: r.oferta_id, pessoas: r.pessoas, nome: r.nome, telefone: r.telefone, desconto: r.desconto_pct, precoUnit: r2(r.valor_pago / r.pessoas),
    total: r.valor_pago, codigo: r.codigo, status: STATUS_SITE[r.status] || 'cancelada', criada: r.criado_em, usadaEm: r.validado_em, inicio: o?.inicio,
    titulo: pa?.titulo, cidade: pa?.cidade, operador: pr?.nome, motivoCancelamento: r.cancelado_motivo,
    avaliada: db.avaliacoes.some(a => a.reserva_id === r.id), qr: r.status === 'confirmada' ? assinar(dadosDoQr(r)) : null,
    passeioId: r.passeio_id, duracaoMin: pa?.duracao_min ?? null, observacoes: ou(r.observacoes), pessoasChegaram: r.pessoas_chegaram ?? null,
    horasCancelar: r.horas_cancelar ?? HORAS_CANCELAR, obsCancelamento: ou(pa?.regras_cancelamento), pontoEncontro: ou(pa?.ponto_encontro), ...local(pa),
    telefoneParceiro: comTelefone ? ou(pr?.telefone) : null, avisos: avisos(r) };
};
// Dados do usuário que podem ir para o navegador (nunca a senha).
const pub = u => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, status: u.status, ...(u.papel ? { papel: u.papel } : {}) });

// Reserva como o painel do operador mostra e como vai para o celular validar sem internet.
const resumoReserva = r => {
  const o = ofertaDe(r.oferta_id), pa = passeioDe(r.passeio_id);
  return { id: r.id, codigo: r.codigo, oferta_id: r.oferta_id, turista_nome: nomeCurto(r.nome), pessoas: r.pessoas, pessoas_chegaram: r.pessoas_chegaram,
    passeio: pa?.titulo, inicio: o?.inicio, duracao_min: pa?.duracao_min, status: r.status, validado_em: r.validado_em, validado_por: r.validado_por,
    aparelho: r.aparelho, modo: r.modo, observacoes: r.observacoes || '' };
};

// Cancela uma reserva. devolve = o turista recebe tudo de volta (então não há comissão nem valor para o parceiro).
// Enquanto o pagamento não passa pelo app (status_pagamento 'pendente'), não há o que estornar.
const cancelar = (r, status, motivo, devolve) => {
  Object.assign(r, { status, cancelado_em: iso(), cancelado_motivo: texto(motivo) });
  if (!devolve) return;
  Object.assign(r, { comissao: 0, valor_parceiro: 0 });
  if (r.status_pagamento === 'pago') Object.assign(r, { reembolso: r.valor_pago, status_pagamento: 'estornado' });
};

const email = (para, assunto, corpo) => db.emails.push({ id: db.seq++, para, assunto, texto: corpo, status: 'simulado', criado_em: iso() }); // sem serviço de e-mail ainda
const emailDoTurista = r => db.users.find(u => u.id === r.turista_id)?.email;
const auditar = (quem, acao, alvo_tipo, alvo_id, detalhe = '') =>
  db.auditoria.push({ id: db.seq++, quem: quem.nome, acao, alvo_tipo, alvo_id, detalhe: texto(detalhe, 300), criado_em: iso() });

// Passeio que saiu do ar porque não vai acontecer: cancela as reservas confirmadas das saídas que ainda não começaram,
// com devolução total, e avisa cada turista. Devolve quantas cancelou. filtro escolhe as reservas (do passeio ou do parceiro).
const cancelarFuturas = filtro => {
  let n = 0;
  for (const r of db.reservas) {
    const o = ofertaDe(r.oferta_id);
    if (r.status !== 'confirmada' || !filtro(r) || !(falta(o) > 0)) continue;
    cancelar(r, 'cancelada_parceiro', 'O passeio não está mais disponível', true);
    email(emailDoTurista(r), 'Seu passeio foi cancelado', `${passeioDe(r.passeio_id)?.titulo} em ${new Date(o.inicio).toLocaleString('pt-BR')} foi cancelado. Se você já pagou, a devolução é total.`);
    n++;
  }
  return n;
};

// Repasse semanal do parceiro (segunda a domingo; pagamento previsto na sexta seguinte).
// Conta: reservas validadas − comissão − destaque pago (proporcional aos dias) + ajustes + no-shows sem a comissão.
const meiaNoite = t => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };
const somaDias = (t, n) => { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); };
const segunda = t => { const d = new Date(meiaNoite(t)); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return d.getTime(); };
const soma = (l, f) => r2(l.reduce((s, x) => s + f(x), 0));
const repasses = (pid, agora = Date.now()) => {
  const semanas = new Map(), destaques = db.destaques.filter(d => d.parceiro_id === pid);
  const semana = t => { const k = segunda(t); if (!semanas.has(k)) semanas.set(k, { validadas: [], noshow: [] }); return semanas.get(k); };
  for (const r of db.reservas) {
    if (r.parceiro_id !== pid) continue;
    if (r.status === 'validada') semana(Date.parse(r.validado_em)).validadas.push(r);
    else if (r.status === 'no_show') semana(Date.parse(ofertaDe(r.oferta_id).inicio)).noshow.push(r);
  }
  const atual = segunda(agora);
  semana(atual);
  return [...semanas.keys()].filter(k => k <= atual).sort((a, b) => a - b).map(k => {
    const s = semanas.get(k), fim = somaDias(k, 7), sk = ymd(k);
    let dias = 0;
    for (let t = k; t < fim; t = somaDias(t, 1)) dias += destaques.filter(d => ymd(t) >= d.inicio && ymd(t) <= d.fim).length;
    const ajustes = [];
    if (s.noshow.length) ajustes.push({ descricao: `No-show: valor retido de ${s.noshow.length} reserva(s), já sem a comissão`, valor: soma(s.noshow, r => r.valor_pago - r.comissao) });
    db.ajustes.filter(a => a.parceiro_id === pid && a.semana === sk).forEach(a => ajustes.push({ descricao: a.descricao, valor: a.valor }));
    const bruto = soma(s.validadas, r => r.valor_pago), comissao = soma(s.validadas, r => r.comissao), destaque = r2(dias * DESTAQUE_MENSAL / 30);
    const analise = db.analises.find(a => a.parceiro_id === pid && a.semana === sk), pago = db.repasses_pagos.find(p => p.parceiro_id === pid && p.semana === sk);
    return {
      id: `rep_${pid}_${sk}`, parceiro_id: pid, semana_inicio: sk, semana_fim: ymd(somaDias(k, 6)), data_pagamento: ymd(somaDias(k, 11)),
      qtd: s.validadas.length, pessoas: s.validadas.reduce((t, r) => t + (r.pessoas_chegaram || r.pessoas), 0), bruto, comissao_pct: parceiroDe(pid)?.comissao_pct,
      comissao, destaque, ajustes, liquido: r2(bruto - comissao - destaque + soma(ajustes, a => a.valor)),
      status: fim > agora ? 'aberto' : pago ? 'pago' : analise ? 'em_analise' : 'agendado', motivo_analise: analise?.motivo || '',
      pago_em: pago?.pago_em || null, comprovante: pago?.comprovante || null, reservas_ids: s.validadas.map(r => r.id), noshow_ids: s.noshow.map(r => r.id), criado_em: iso(fim)
    };
  });
};

// Campos de passeio que o operador (ou o admin) pode mandar, já limpos. Lança erro com a mensagem para a tela.
const falha = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status, publico: true }); };
const FOTO_URL = /^(\/img\/[\w\-./]+|data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*)$/;
const limparPasseio = campos => {
  const c = {}, num = ['duracao_min', 'capacidade', 'preco', 'desconto_max_padrao', 'lat', 'lng', 'horas_cancelar'];
  for (const k of ['titulo', 'categoria', 'cidade', 'descricao', 'duracao_min', 'ponto_encontro', 'lat', 'lng', 'capacidade', 'preco', 'desconto_max_padrao',
    'hora_padrao', 'responsavel', 'inclui', 'levar', 'idiomas', 'acessibilidade', 'acessivel', 'horas_cancelar', 'regras_cancelamento', 'fotos', 'capa_id']) {
    const v = campos?.[k];
    if (v === undefined) continue;
    c[k] = num.includes(k) ? (v === '' || v === null ? null : +v) : k === 'fotos' ? v : k === 'acessivel' ? v === true || v === 'true' : texto(v, k === 'descricao' ? 2000 : 300);
  }
  if (c.horas_cancelar !== undefined && !OPCOES_CANCELAR.includes(c.horas_cancelar)) falha(`Escolha ${OPCOES_CANCELAR.join(', ')} horas para o cancelamento grátis.`);
  if (c.titulo !== undefined && c.titulo.length < 3) falha('Dê um nome ao passeio.');
  if (c.categoria !== undefined && !ehCategoria(c.categoria)) falha('Escolha uma categoria da lista: ' + CATEGORIAS.map(x => x[1]).join(', ') + '.');
  if (c.cidade !== undefined && !ehCidade(c.cidade)) falha('Escolha uma das cidades da Quarta Colônia.');
  if (c.preco !== undefined && !(c.preco > 0 && c.preco <= 100000)) falha('Informe o preço cheio.');
  if (c.capacidade !== undefined && !(Number.isInteger(c.capacidade) && c.capacidade >= 1 && c.capacidade <= 200)) falha('A capacidade precisa ficar entre 1 e 200.');
  if (c.duracao_min !== undefined && !(c.duracao_min > 0 && c.duracao_min <= 7 * 24 * 60)) falha('Informe a duração.');
  if (c.desconto_max_padrao !== undefined && !(c.desconto_max_padrao >= 0 && c.desconto_max_padrao <= 90)) falha('O desconto máximo precisa ficar entre 0% e 90%.');
  for (const k of ['lat', 'lng']) if (c[k] !== undefined && c[k] !== null && !Number.isFinite(c[k])) falha('Localização inválida.');
  if (c.hora_padrao !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.hora_padrao)) falha('Horário inválido. Use o formato 14:30.');
  if (c.fotos !== undefined) {
    if (!Array.isArray(c.fotos) || c.fotos.length > 8) falha('No máximo 8 fotos.');
    c.fotos = c.fotos.map(f => {
      if (!f || typeof f !== 'object' || (f.url != null && !FOTO_URL.test(f.url))) falha('Foto inválida. Use JPG, PNG ou WebP.');
      return { id: texto(f.id, 60), url: f.url ?? null, tom: Number.isInteger(f.tom) ? f.tom : 0 };
    });
  }
  return c;
};

module.exports = {
  DIA, passeioDe, parceiroDe, ofertaDe, falta, ativa, ocupadas, livres, pct, visivel, vis, detalhe, rvis, pub, resumoReserva, cancelar, cancelarFuturas,
  destaqueAtivo, avaliacoesDe, notaDe, ou, ROTULO_CANCELAMENTO, email, emailDoTurista, auditar, repasses, meiaNoite, somaDias, falha, limparPasseio, FOTO_URL
};
