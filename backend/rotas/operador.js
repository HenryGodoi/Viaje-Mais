// Rotas do painel do operador (Dashboard, pasta operador/). Respondem no formato do Dashboard (snake_case).
// O painel só fala com o servidor por estas portas: painel (tudo o que ele vê), acoes/:nome, validar, dia e sincronizar.
// As ações e mensagens de erro são as do "servidor de demonstração" do Dashboard (operador/dados.js), agora no servidor de verdade.
const crypto = require('crypto');
const { db, save } = require('../banco');
const { hash, check } = require('../seguranca');
const { remover, sairDosOutros } = require('../sessoes');
const { send } = require('../http');
const { DESTAQUE_MENSAL } = require('../config');
const { iso, r2, ymd, texto, ehCidade, ehCategoria, nomeCurto, mascTelefone, mascChave, novaSolicitacao, novoPasseio } = require('../modelo');
const { passeioDe, parceiroDe, ofertaDe, ativa, ocupadas, resumoReserva, cancelar, email: enviarEmail, emailDoTurista, repasses,
  meiaNoite, somaDias, falha, limparPasseio, FOTO_URL } = require('../regras');
const { chavePublica, conferir } = require('../voucher');

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const mesmoDia = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();
const doParceiro = u => parceiroDe(u.parceiro_id) || falha('Esta conta não está ligada a um parceiro. Fale com o Viaje Mais.', 403);
// Registro do próprio parceiro; o de outro parceiro responde como se não existisse.
const minha = (lista, id, u) => { const x = lista.find(i => i.id === +id); if (!x || x.parceiro_id !== u.parceiro_id) falha('Registro não encontrado entre os seus.', 404); return x; };

// Tudo o que o operador logado pode ver, já filtrado e com os dados pessoais mascarados (o navegador não é confiável).
const visao = (u, sessao) => {
  const pid = u.parceiro_id, agora = Date.now(), meu = x => x.parceiro_id === pid, validador = u.papel === 'validador';
  const equipe = db.users.filter(meu);
  // Telefone completo do turista só no dia do passeio e em reserva não cancelada.
  const reservas = db.reservas.filter(meu).map(({ nome, telefone, turista_id, codigos_antigos, historico, ...r }) => ({
    ...r, turista_nome: nomeCurto(nome), turista_tel: mascTelefone(telefone), turista_tel_completo: mesmoDia(ofertaDe(r.oferta_id)?.inicio, agora) && ativa(r) ? telefone : null }));
  const { pix_chave, ...parceiro } = doParceiro(u);
  return {
    servidor_dia: new Date(agora).toDateString(), carregado_em: iso(agora),
    usuario: { id: u.id, nome: u.nome, email: u.email, papel: u.papel },
    parceiro: { ...parceiro, pix_mascarada: mascChave(pix_chave) },
    passeios: db.passeios.filter(meu), ofertas: db.ofertas.filter(meu), reservas,
    tentativas: db.tentativas.filter(meu),
    avaliacoes: validador ? [] : db.avaliacoes.filter(meu).map(({ turista_id, ...a }) => a),
    repasses: validador ? [] : repasses(pid, agora),
    destaques: db.destaques.filter(meu),
    solicitacoes: db.solicitacoes.filter(meu).map(({ chave_nova, ...s }) => s),
    equipe: validador ? [] : equipe.map(x => ({ id: x.id, parceiro_id: x.parceiro_id, nome: x.nome, email: x.email, papel: x.papel, status: x.status, criado_em: x.criado_em })),
    sessoes: db.sessoes.filter(s => validador ? s.usuario_id === u.id : equipe.some(x => x.id === s.usuario_id)).map(s => ({
      id: s.id, usuario_id: s.usuario_id, aparelho: s.aparelho, detalhe: '', ultimo_acesso: s.ultimo_acesso, atual: s.id === sessao?.id,
      usuario_nome: equipe.find(x => x.id === s.usuario_id)?.nome || '' }))
  };
};

// Validação no balcão (código de 8 letras ou QR assinado). Responde { tipo, reserva }; toda recusa vai para "tentativas".
// Janela normal: de 2h antes até o fim do passeio + 1h, no mesmo dia. Fora dela, o operador pode aceitar com "forcar".
const foraDaJanela = (inicio, duracao, t) => { const i = Date.parse(inicio); return !mesmoDia(i, t) || t < i - 2 * 36e5 || t > i + ((duracao || 0) + 60) * 6e4; };
const validar = ({ codigo, qr, forcar, aparelho, modo, quando }, u) => {
  const agora = Date.now(), tq = Date.parse(quando), t = tq <= agora + 5 * 6e4 ? tq : agora; // hora da validação feita sem internet
  const quandoIso = iso(t);
  aparelho = texto(aparelho, 60) || 'Este aparelho'; modo = modo === 'offline' ? 'offline' : 'online';
  const dados = qr ? conferir(qr) : null;
  codigo = qr ? dados?.c || '' : texto(codigo, 12).toUpperCase();
  const r = codigo && db.reservas.find(x => x.codigo === codigo);
  const tentar = motivo => db.tentativas.push({ id: db.seq++, parceiro_id: u.parceiro_id, codigo, motivo, reserva_id: r && r.parceiro_id === u.parceiro_id ? r.id : null,
    usuario: u.nome, aparelho, modo, criado_em: quandoIso });
  if (qr && !dados) { tentar('qr_invalido'); return { tipo: 'qr_invalido' }; } // assinatura não confere: QR falso ou alterado
  if (!r) { tentar('nao_encontrado'); return { tipo: 'nao_encontrado', codigo }; }
  if (r.parceiro_id !== u.parceiro_id) { tentar('outro_parceiro'); return { tipo: 'outro_parceiro', codigo }; }
  if (!ativa(r)) { tentar('cancelada'); return { tipo: 'cancelada', reserva: resumoReserva(r) }; }
  if (r.status === 'validada') { tentar('ja_usado'); return { tipo: 'ja_usado', reserva: resumoReserva(r) }; }
  const info = resumoReserva(r);
  if (!forcar && foraDaJanela(info.inicio, info.duracao_min, t)) return { tipo: 'outro_horario', reserva: info };
  Object.assign(r, { status: 'validada', validado_em: quandoIso, validado_por: u.nome, aparelho, modo, sincronizado_em: iso(agora), pessoas_chegaram: r.pessoas,
    aceito_com_aviso: typeof forcar === 'string' ? texto(forcar, 30) : forcar ? 'outro_horario' : '' });
  return { tipo: 'liberada', reserva: resumoReserva(r) };
};

// Cada ação recebe (dados enviados, usuário logado, agora, { sessao, tok }). Erro de regra: falha('mensagem') → 400 com { erro }.
// Todas conferem tudo antes de mudar qualquer coisa, para um erro no meio não deixar dado pela metade.
const ACOES = {
  publicarOfertas({ passeio_id, inicios, vagas, preco, desconto_max, responsavel }, u, agora) {
    const ps = minha(db.passeios, passeio_id, u);
    if (doParceiro(u).status !== 'ativo') falha('Seu cadastro está suspenso. Fale com o Viaje Mais.');
    if (ps.status !== 'ativo') falha('Este passeio ainda não foi aprovado pelo Viaje Mais.');
    vagas = Math.round(+vagas); desconto_max = Math.round(+desconto_max); preco = r2(+(preco ?? ps.preco));
    if (!(vagas >= 1 && vagas <= 200)) falha('As vagas precisam ficar entre 1 e 200.');
    if (!(desconto_max >= 0 && desconto_max <= 90)) falha('O desconto máximo precisa ficar entre 0% e 90%.');
    if (!(preco > 0 && preco <= 100000)) falha('Informe o preço cheio por pessoa.');
    if (!Array.isArray(inicios) || !inicios.length) falha('Escolha pelo menos uma data.');
    if (inicios.length > 100) falha('No máximo 100 saídas de uma vez.');
    const ts = inicios.map(i => Date.parse(i));
    if (ts.some(t => !(t > agora))) falha('Um dos horários já passou. Escolha um horário futuro.');
    const resp = texto(responsavel || ps.responsavel, 80);
    for (const t of ts) db.ofertas.push({ id: db.seq++, passeio_id: ps.id, parceiro_id: u.parceiro_id, inicio: iso(t), vagas, preco, desconto_max, responsavel: resp,
      status: 'ativa', motivo_cancelamento: '', cancelado_em: null, criado_em: iso(agora) });
    return { n: ts.length };
  },
  editarOferta({ id, vagas, desconto_max, status }, u, agora) {
    const o = minha(db.ofertas, id, u);
    if (o.status === 'cancelada') falha('Esta saída foi cancelada.');
    if (Date.parse(o.inicio) <= agora) falha('Esta saída já começou.');
    const min = Math.max(1, ocupadas(o));
    if (vagas != null) { vagas = Math.round(+vagas); if (!(vagas >= min && vagas <= 200)) falha(`As vagas precisam ficar entre ${min} (já reservadas) e 200.`); }
    if (desconto_max != null) { desconto_max = Math.round(+desconto_max); if (!(desconto_max >= 0 && desconto_max <= 90)) falha('O desconto máximo precisa ficar entre 0% e 90%.'); }
    if (vagas != null) o.vagas = vagas;
    if (desconto_max != null) o.desconto_max = desconto_max;
    if (status) o.status = status === 'pausada' ? 'pausada' : 'ativa';
  },
  cancelarOferta({ id, motivo }, u, agora) {
    const o = minha(db.ofertas, id, u), ps = passeioDe(o.passeio_id);
    motivo = texto(motivo);
    if (!motivo) falha('Informe o motivo do cancelamento.');
    if (o.status === 'cancelada') falha('Esta saída já foi cancelada.');
    if (Date.parse(o.inicio) <= agora) falha('Esta saída já começou.');
    Object.assign(o, { status: 'cancelada', motivo_cancelamento: motivo, cancelado_em: iso(agora) });
    let n = 0;
    for (const r of db.reservas.filter(x => x.oferta_id === o.id && x.status === 'confirmada')) {
      cancelar(r, 'cancelada_parceiro', motivo, true);
      enviarEmail(emailDoTurista(r), 'Seu passeio foi cancelado', `${ps.titulo} em ${new Date(o.inicio).toLocaleString('pt-BR')} foi cancelado (${motivo}). Se você já pagou, a devolução é total.`);
      n++;
    }
    return { n };
  },
  cancelarReserva({ id, motivo }, u, agora) {
    const r = minha(db.reservas, id, u);
    motivo = texto(motivo);
    if (!motivo) falha('Informe o motivo do cancelamento.');
    if (r.status !== 'confirmada') falha('Só dá para cancelar uma reserva confirmada.');
    if (Date.parse(ofertaDe(r.oferta_id).inicio) <= agora) falha('O passeio já começou. Se o turista não veio, use "Marcar no-show".');
    cancelar(r, 'cancelada_parceiro', motivo, true);
    enviarEmail(emailDoTurista(r), 'Sua reserva foi cancelada pelo parceiro', `Reserva ${r.codigo} cancelada (${motivo}). Se você já pagou, a devolução é total.`);
  },
  noShow({ id }, u, agora) {
    const r = minha(db.reservas, id, u);
    if (r.status !== 'confirmada') falha('Só dá para marcar no-show numa reserva confirmada.');
    if (Date.parse(ofertaDe(r.oferta_id).inicio) > agora) falha('Só dá para marcar no-show depois do horário do passeio.');
    r.status = 'no_show';
  },
  ajustarChegada({ id, pessoas }, u) {
    const r = minha(db.reservas, id, u);
    pessoas = Math.round(+pessoas);
    if (r.status !== 'validada') falha('Esta reserva ainda não foi validada.');
    if (!(pessoas >= 1 && pessoas <= r.pessoas)) falha(`Informe de 1 a ${r.pessoas} pessoas.`);
    r.pessoas_chegaram = pessoas;
  },
  // Passeio novo nasce pendente. Em passeio aprovado, título, descrição, preço e fotos viram solicitação para o admin; o resto muda na hora.
  salvarPasseio({ id, campos }, u, agora) {
    const c = limparPasseio(campos);
    const pedido = (tipo, passeio_id, extra) => db.solicitacoes.push(novaSolicitacao({ id: db.seq++, parceiro_id: u.parceiro_id, tipo, passeio_id, criado_em: iso(agora), ...extra }));
    if (!id) {
      const p = novoPasseio({ cidade: doParceiro(u).cidade, ...c, id: db.seq++, parceiro_id: u.parceiro_id, status: 'pendente', criado_em: iso(agora) });
      if (!p.titulo) falha('Dê um nome ao passeio.');
      if (!ehCidade(p.cidade)) falha('Escolha a cidade do passeio.');
      db.passeios.push(p); pedido('passeio_novo', p.id);
      return { novo: true, id: p.id };
    }
    const p = minha(db.passeios, id, u);
    if (p.status !== 'ativo') {
      Object.assign(p, c, { status: 'pendente', motivo_recusa: '' });
      db.solicitacoes = db.solicitacoes.filter(s => !(s.passeio_id === p.id && ['pendente', 'aguardando_parceiro'].includes(s.status)));
      pedido('passeio_novo', p.id);
      return { novo: true };
    }
    const APROVAR = ['titulo', 'descricao', 'preco', 'fotos', 'capa_id'], mudou = {};
    for (const [k, v] of Object.entries(c)) {
      if (JSON.stringify(v) === JSON.stringify(p[k])) continue;
      if (APROVAR.includes(k)) mudou[k] = { de: p[k], para: v }; else p[k] = v;
    }
    if (!Object.keys(mudou).length) return { aprovacao: false };
    const pend = db.solicitacoes.find(s => s.passeio_id === p.id && s.tipo === 'alteracao_passeio' && s.status === 'pendente');
    if (pend) { Object.assign(pend.campos, mudou); pend.criado_em = iso(agora); }
    else pedido('alteracao_passeio', p.id, { campos: mudou });
    return { aprovacao: true };
  },
  ocultarPasseio({ id, oculto }, u) {
    const p = minha(db.passeios, id, u);
    if (p.status !== 'ativo') falha('Só dá para ocultar um passeio aprovado.');
    p.oculto = !!oculto;
  },
  duplicarPasseio({ id }, u, agora) {
    const p = minha(db.passeios, id, u), novo = db.seq++;
    const fotos = p.fotos.map((f, i) => ({ ...f, id: `${novo}_f${i}` })), capa = p.fotos.findIndex(f => f.id === p.capa_id);
    db.passeios.push({ ...structuredClone(p), id: novo, titulo: p.titulo + ' (cópia)', fotos, capa_id: fotos[Math.max(0, capa)]?.id || null, status: 'pendente', oculto: false, motivo_recusa: '', criado_em: iso(agora) });
    db.solicitacoes.push(novaSolicitacao({ id: db.seq++, parceiro_id: u.parceiro_id, tipo: 'passeio_novo', passeio_id: novo, criado_em: iso(agora) }));
    return { id: novo };
  },
  // Destaque pago: 30 dias, R$ 80, descontado do repasse proporcionalmente aos dias.
  destacarPasseio({ id }, u, agora) {
    const p = minha(db.passeios, id, u), hoje = ymd(agora);
    if (doParceiro(u).status !== 'ativo') falha('Seu cadastro está suspenso. Fale com o Viaje Mais.');
    if (p.status !== 'ativo') falha('Só dá para destacar um passeio aprovado.');
    if (db.destaques.some(d => d.passeio_id === p.id && d.fim >= hoje)) falha('Este passeio já está em destaque.');
    const fim = ymd(somaDias(meiaNoite(agora), 29));
    db.destaques.push({ id: db.seq++, parceiro_id: u.parceiro_id, passeio_id: p.id, inicio: hoje, fim, valor_mensal: DESTAQUE_MENSAL, criado_em: iso(agora) });
    return { fim };
  },
  responderAvaliacao({ id, texto: t }, u, agora) {
    const a = minha(db.avaliacoes, id, u);
    t = texto(t, 1000);
    if (t.length < 3 || t.length > 600) falha('A resposta precisa ter de 3 a 600 caracteres.');
    a.resposta = a.resposta ? { ...a.resposta, texto: t, editado_em: iso(agora) } : { texto: t, criado_em: iso(agora), editado_em: null };
  },
  denunciarAvaliacao({ id, motivo, detalhe }, u, agora) {
    const a = minha(db.avaliacoes, id, u);
    if (a.denuncia) falha('Esta avaliação já foi denunciada.');
    if (!texto(motivo)) falha('Escolha o motivo.');
    a.denuncia = { motivo: texto(motivo, 40), detalhe: texto(detalhe, 400), status: 'em_analise', criado_em: iso(agora) };
  },
  // Voucher recusado no balcão (decisão do operador), para o histórico de tentativas.
  registrarRecusa({ codigo, tipo, aparelho, modo, quando }, u, agora) {
    codigo = texto(codigo, 12).toUpperCase();
    const r = db.reservas.find(x => x.codigo === codigo && x.parceiro_id === u.parceiro_id), tq = Date.parse(quando);
    db.tentativas.push({ id: db.seq++, parceiro_id: u.parceiro_id, codigo, motivo: 'recusado_' + texto(tipo, 30), reserva_id: r ? r.id : null, usuario: u.nome,
      aparelho: texto(aparelho, 60) || 'Este aparelho', modo: modo === 'offline' ? 'offline' : 'online', criado_em: iso(tq <= agora + 5 * 6e4 ? tq : agora) });
  },
  salvarPerfil({ campos = {} }, u) {
    const p = doParceiro(u), novo = {};
    for (const k of ['nome', 'categoria', 'cidade', 'endereco', 'telefone', 'email', 'cadastur', 'horario']) if (campos[k] !== undefined) novo[k] = texto(campos[k]);
    for (const k of ['lat', 'lng']) if (campos[k] !== undefined && campos[k] !== '' && Number.isFinite(+campos[k])) novo[k] = +campos[k];
    if (campos.foto !== undefined) {
      if (campos.foto !== null && !(typeof campos.foto === 'string' && FOTO_URL.test(campos.foto) && campos.foto.length <= 300000)) falha('Foto inválida. Use JPG, PNG ou WebP.');
      novo.foto = campos.foto;
    }
    const final = { ...p, ...novo };
    if (final.nome.length < 2) falha('Informe o nome do negócio.');
    if (!EMAIL.test(final.email)) falha('E-mail inválido.');
    if (novo.categoria !== undefined && !ehCategoria(novo.categoria)) falha('Categoria inválida.');
    if (novo.cidade !== undefined && !ehCidade(novo.cidade)) falha('Escolha uma das cidades da Quarta Colônia.');
    Object.assign(p, novo);
  },
  salvarPreferencias({ preferencias }, u) {
    if (!preferencias || typeof preferencias !== 'object' || Array.isArray(preferencias) || JSON.stringify(preferencias).length > 2000) falha('Preferências inválidas.');
    const p = doParceiro(u);
    p.preferencias = { ...p.preferencias, ...preferencias };
  },
  // Sem serviço de e-mail ainda, o pedido vai direto para o admin aprovar (sem o link de confirmação).
  trocarPix({ chave, tipo }, u, agora) {
    const p = doParceiro(u);
    chave = texto(chave, 100);
    if (chave.length < 5) falha('Informe a nova chave Pix.');
    db.solicitacoes = db.solicitacoes.filter(s => !(s.tipo === 'pix' && s.status === 'pendente' && s.parceiro_id === p.id));
    db.solicitacoes.push(novaSolicitacao({ id: db.seq++, parceiro_id: p.id, tipo: 'pix', campos: { pix: { de: mascChave(p.pix_chave), para: mascChave(chave), tipo: texto(tipo, 30) } },
      chave_nova: chave, criado_em: iso(agora) }));
    enviarEmail(p.email, 'Pedido de troca da chave Pix', 'Recebemos o pedido de troca da chave Pix. O Viaje Mais confere antes de passar a usar a chave nova.');
  },
  // Validador novo: a senha provisória volta uma vez só, para o dono repassar (sem serviço de e-mail ainda).
  convidar({ nome, email }, u, agora) {
    nome = texto(nome, 80); email = texto(email, 120).toLowerCase();
    if (nome.length < 2) falha('Informe o nome.');
    if (!EMAIL.test(email)) falha('E-mail inválido.');
    if (db.users.some(x => x.email === email)) falha('Este e-mail já tem uma conta no Viaje Mais.');
    const senha_provisoria = crypto.randomBytes(6).toString('hex');
    db.users.push({ id: db.seq++, nome, email, senha: hash(senha_provisoria), perfil: 'operador', status: 'convidado', parceiro_id: u.parceiro_id, papel: 'validador', criado_em: iso(agora) });
    enviarEmail(email, 'Convite para validar vouchers', `${u.nome} convidou você para validar os vouchers no painel do parceiro Viaje Mais.`);
    return { senha_provisoria };
  },
  removerMembro({ id }, u) {
    const m = minha(db.users, id, u);
    if (m.papel === 'dono' || m.id === u.id) falha('Não dá para remover o responsável.');
    db.users = db.users.filter(x => x.id !== m.id);
    sairDosOutros(m.id);
  },
  encerrarSessao({ id }, u, agora, { sessao }) {
    const daEquipe = s => u.papel === 'validador' ? s.usuario_id === u.id : db.users.some(x => x.id === s.usuario_id && x.parceiro_id === u.parceiro_id);
    if (id === 'outras') return void remover(s => daEquipe(s) && s.id !== sessao.id);
    const s = db.sessoes.find(x => x.id === +id && daEquipe(x));
    if (!s) falha('Sessão não encontrada.', 404);
    remover(x => x === s);
  },
  trocarSenha({ atual, nova, confirma }, u, agora, { tok }) {
    if (!check(String(atual || ''), u.senha)) falha('A senha atual não confere.');
    if (String(nova || '').length < 8) falha('A nova senha precisa ter pelo menos 8 caracteres.');
    if (nova !== confirma) falha('A confirmação não bate com a nova senha.');
    u.senha = hash(String(nova));
    sairDosOutros(u.id, tok); // os outros aparelhos precisam entrar de novo
    return { ok: true };
  },
};
const DO_VALIDADOR = new Set(['registrarRecusa', 'ajustarChegada', 'trocarSenha', 'encerrarSessao']);

module.exports = [
  { metodo: 'GET', caminho: '/api/operador/painel', quem: 'operador', fazer: ({ res, me, sessao }) => send(res, 200, visao(me, sessao)) },
  { metodo: 'POST', caminho: '/api/operador/acoes/:nome', quem: 'operador', fazer: ({ res, me, b, nome, sessao, tok }) => {
    if (!Object.hasOwn(ACOES, nome)) return send(res, 404, { erro: 'Ação desconhecida.' });
    if (me.papel === 'validador' && !DO_VALIDADOR.has(nome)) return send(res, 403, { erro: 'Seu acesso é só de validação. Peça ao responsável.' });
    doParceiro(me);
    const r = ACOES[nome](b, me, Date.now(), { sessao, tok });
    save(); send(res, 200, r || {});
  } },
  { metodo: 'POST', caminho: '/api/operador/validar', quem: 'operador', fazer: ({ res, me, b }) => { doParceiro(me); const r = validar(b, me); save(); send(res, 200, r); } },
  // Reservas de hoje + chave pública: o celular guarda isso para validar sem internet.
  { metodo: 'GET', caminho: '/api/operador/dia', quem: 'operador', fazer: ({ res, me }) => {
    doParceiro(me);
    const agora = Date.now(), deHoje = new Set(db.ofertas.filter(o => o.parceiro_id === me.parceiro_id && mesmoDia(o.inicio, agora)).map(o => o.id));
    send(res, 200, { servidor_dia: new Date(agora).toDateString(), baixado_em: iso(agora), parceiro_id: me.parceiro_id, chave_publica: chavePublica(),
      reservas: db.reservas.filter(r => deHoje.has(r.oferta_id)).map(resumoReserva) });
  } },
  // Validações feitas sem internet: o servidor confere cada uma de novo. Conflito = já usado, cancelado etc. (ex.: o mesmo voucher em dois celulares).
  { metodo: 'POST', caminho: '/api/operador/sincronizar', quem: 'operador', fazer: ({ res, me, b }) => {
    doParceiro(me);
    const conflitos = [];
    let ok = 0;
    for (const p of (Array.isArray(b.pendentes) ? b.pendentes : []).slice(0, 500)) {
      if (!p || typeof p !== 'object') continue;
      if (p.decisao !== 'liberada') { ACOES.registrarRecusa({ codigo: p.codigo, tipo: p.tipo, aparelho: p.aparelho, modo: 'offline', quando: p.quando }, me, Date.now()); ok++; continue; }
      const v = validar({ codigo: p.codigo, forcar: p.aviso || 'offline', aparelho: p.aparelho, modo: 'offline', quando: p.quando }, me);
      if (v.tipo !== 'liberada') { conflitos.push({ codigo: texto(p.codigo, 12), tipo: v.tipo, reserva: v.reserva || null }); continue; }
      const r = db.reservas.find(x => x.id === v.reserva.id), n = Math.round(+p.pessoas);
      if (n >= 1 && n <= r.pessoas) r.pessoas_chegaram = n;
      ok++;
    }
    save(); send(res, 200, { ok, conflitos });
  } },
];
