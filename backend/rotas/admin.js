// Rotas do painel do admin (Dashboard, pasta admin/): painel (tudo o que ele vê), acoes/:nome e dados-pessoais.
// O banco segue o formato do painel do operador; aqui ele é convertido para o formato que o admin lê (admin/dados.js).
// Toda ação grava uma linha na auditoria (quem, o quê, em quem, quando).
const crypto = require('crypto');
const { db, save } = require('../banco');
const { hash, cod } = require('../seguranca');
const { sairDosOutros } = require('../sessoes');
const { send } = require('../http');
const { CATEGORIAS, CIDADES, COMISSAO_PADRAO, DESTAQUE_MENSAL, HORAS_ULTIMA } = require('../config');
const { iso, ymd, texto, ehCategoria, ehCidade, idCidade, mascTelefone, mascChave, mascEmail, novoParceiro } = require('../modelo');
const { passeioDe, parceiroDe, ofertaDe, ativa, livres, cancelar, email: enviarEmail, emailDoTurista, auditar, repasses, falha, limparPasseio } = require('../regras');

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/, DATA = /^\d{4}-\d{2}-\d{2}$/;
const achar = (lista, id, nome) => lista.find(x => x.id === +id) || falha(`${nome} não encontrado(a).`, 404);
const donoDe = pid => db.users.find(u => u.parceiro_id === pid && u.papel === 'dono');
const nomeCidade = id => CIDADES.find(c => c.id === id)?.nome;
const destaqueAtivo = (passeio_id, hoje = ymd(Date.now())) => db.destaques.find(d => d.passeio_id === passeio_id && d.inicio <= hoje && hoje <= d.fim);

// Nomes de status e de tipo que o painel admin usa.
const VOUCHER = { confirmada: 'emitido', validada: 'validado', no_show: 'expirado' }; // as canceladas: 'cancelado'
const TENTATIVA = { ja_usado: 'codigo_repetido', nao_encontrado: 'codigo_inexistente', cancelada: 'voucher_cancelado' };
const ROTULO = { titulo: 'Nome', descricao: 'Descrição', preco: 'Preço cheio por pessoa', fotos: 'Fotos', capa_id: 'Foto de capa' };

const solicitacaoAdmin = ({ chave_nova, ...s }) => {
  const pa = parceiroDe(s.parceiro_id), ps = passeioDe(s.passeio_id), cidade_id = idCidade(ps?.cidade || pa?.cidade);
  if (s.tipo === 'parceiro') return { ...s, tipo: 'parceiro', alvo_tipo: 'parceiro', alvo_id: s.parceiro_id, cidade_id, titulo: pa?.nome, subtitulo: `Novo parceiro · ${pa?.cidade || 'cidade não informada'}` };
  if (s.tipo === 'passeio_novo') return { ...s, tipo: 'passeio', alvo_tipo: 'passeio', alvo_id: s.passeio_id, cidade_id, titulo: ps?.titulo, subtitulo: `Novo passeio · ${pa?.nome}` };
  if (s.tipo === 'pix') return { ...s, tipo: 'alteracao', alvo_tipo: 'parceiro', alvo_id: s.parceiro_id, cidade_id, campo: 'pix_chave', rotulo: 'Chave Pix de repasse',
    antes: s.campos?.pix?.de, depois: s.campos?.pix?.para, titulo: `Dados de recebimento: ${pa?.nome}`, subtitulo: `Alteração de Pix · ${pa?.nome}` };
  // alteracao_passeio: "campos" tem todas as mudanças; campo/antes/depois repetem a primeira, para a tela de uma mudança só.
  const [campo, { de, para } = {}] = Object.entries(s.campos || {})[0] || [];
  return { ...s, tipo: 'alteracao', alvo_tipo: 'passeio', alvo_id: s.passeio_id, cidade_id, campo, rotulo: ROTULO[campo] || campo, antes: de, depois: para,
    titulo: `Alteração: ${ps?.titulo}`, subtitulo: `Alteração de dados · ${pa?.nome}` };
};

// Tudo o que o painel admin mostra. E-mail, telefone e Pix vão mascarados: o dado completo só pela rota dados-pessoais, que registra o acesso.
const visao = me => {
  const hoje = ymd(Date.now()), clientes = new Map(db.users.filter(u => u.perfil === 'cliente').map(u => [u.id, u]));
  const ultimoTel = new Map(db.reservas.map(r => [r.turista_id, r.telefone]));
  const turistas = [...new Set(db.reservas.map(r => r.turista_id))].map(id => {
    const u = clientes.get(id);
    return u ? { id, nome: u.nome, email: mascEmail(u.email), telefone: mascTelefone(u.telefone || ultimoTel.get(id)), cidade_origem: '', criado_em: u.criado_em }
      : { id: id ?? 0, nome: 'Conta excluída', email: '', telefone: '', cidade_origem: '', criado_em: null };
  });
  const vouchers = db.reservas.flatMap(r => [
    ...r.codigos_antigos.map((c, i) => ({ id: `vou_${r.id}_${i}`, codigo: c.codigo, reserva_id: r.id, status: 'cancelado', validado_por: null, validado_em: null, modo: null, motivo: c.motivo, criado_em: c.emitido_em })),
    { id: `vou_${r.id}`, codigo: r.codigo, reserva_id: r.id, status: VOUCHER[r.status] || 'cancelado', validado_por: r.validado_por || null, validado_em: r.validado_em, modo: r.modo || null,
      motivo: ativa(r) ? null : 'Reserva cancelada', criado_em: r.voucher_emitido_em }
  ]);
  return {
    versao: 2, carregado_em: iso(),
    admin: { id: me.id, nome: me.nome, papel: 'Administrador' },
    config: { comissao_padrao: COMISSAO_PADRAO, destaque_mensal: DESTAQUE_MENSAL, horas_ultima: HORAS_ULTIMA },
    categorias: CATEGORIAS.map(([id, nome]) => ({ id, nome })), cidades: CIDADES,
    parceiros: db.parceiros.map(({ pix_chave, ...p }) => ({ ...p, cidade_id: idCidade(p.cidade), responsavel: p.responsavel || donoDe(p.id)?.nome || '', pix_mascarada: mascChave(pix_chave) })),
    comissoes_historico: db.comissoes_historico, destaques: db.destaques,
    passeios: db.passeios.map(p => ({ ...p, cidade_id: idCidade(p.cidade), status: p.status === 'ativo' && p.oculto ? 'oculto' : p.status, destaque: !!destaqueAtivo(p.id, hoje) })),
    ofertas: db.ofertas, turistas,
    reservas: db.reservas.map(({ nome, telefone, codigos_antigos, ...r }) => {
      const o = ofertaDe(r.oferta_id), ps = passeioDe(r.passeio_id);
      return { ...r, turista_id: r.turista_id ?? 0, cidade_id: idCidade(ps?.cidade), motivo_cancelamento: r.cancelado_motivo || null, voucher_enviado_em: r.voucher_emitido_em,
        ultima_hora: Date.parse(o?.inicio) - Date.parse(r.criado_em) <= HORAS_ULTIMA * 36e5 };
    }),
    vouchers, tentativas: db.tentativas.map(t => ({ ...t, motivo: TENTATIVA[t.motivo] || t.motivo })),
    sincronizacao: [], // as validações sem internet ficam no celular até sincronizar; o servidor só vê as que já chegaram
    avaliacoes: db.avaliacoes,
    repasses: db.parceiros.flatMap(p => repasses(p.id).map(r => ({ ...r, reservas: r.qtd, previsto_em: r.data_pagamento }))),
    solicitacoes: db.solicitacoes.map(solicitacaoAdmin),
    auditoria: db.auditoria, emails: db.emails
  };
};

const pendente = s => ['pendente', 'aguardando_parceiro'].includes(s.status) || falha('Esta solicitação já foi decidida.');
const decidir = (s, me, status, motivo = '') => Object.assign(s, { status, motivo, decidido_em: iso(), decidido_por: me.nome });
const tituloSol = s => solicitacaoAdmin(s).titulo;
const exigir = (v, msg, max = 600) => texto(v, max) || falha(msg);
const reservaAberta = r => r.status === 'confirmada' || falha('Esta reserva não está mais em aberto.');
const linhaDoTempo = (r, titulo, txt) => r.historico.push({ titulo, quando: iso(), texto: txt });
const quando = t => new Date(t).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

// Cada ação recebe (dados enviados, admin logado). Erro de regra: falha('mensagem') → 400 com { erro }. Confere tudo antes de mudar.
const ACOES = {
  // Aprovar aplica a mudança: parceiro e passeio ficam ativos, preço/descrição/fotos novos entram, a chave Pix nova passa a valer.
  aprovarSolicitacao({ id }, me) {
    const s = achar(db.solicitacoes, id, 'Solicitação'), pa = parceiroDe(s.parceiro_id), ps = passeioDe(s.passeio_id);
    pendente(s);
    if (s.tipo === 'parceiro') {
      pa.status = 'ativo';
      db.users.filter(u => u.parceiro_id === pa.id && u.status === 'pendente').forEach(u => { u.status = 'ativo'; });
    } else if (s.tipo === 'passeio_novo') Object.assign(ps, { status: 'ativo', motivo_recusa: '' });
    else if (s.tipo === 'alteracao_passeio') for (const [k, { para }] of Object.entries(s.campos || {})) ps[k] = para;
    else if (s.tipo === 'pix') Object.assign(pa, { pix_chave: s.chave_nova, pix_tipo: s.campos?.pix?.tipo || '' });
    decidir(s, me, 'aprovada');
    enviarEmail(pa?.email, `Aprovado: ${tituloSol(s)}`, 'Sua solicitação foi aprovada e já vale no Viaje Mais.');
    auditar(me, 'aprovou solicitação', 'solicitacao', s.id, tituloSol(s));
  },
  recusarSolicitacao({ id, motivo }, me) {
    const s = achar(db.solicitacoes, id, 'Solicitação'), pa = parceiroDe(s.parceiro_id);
    pendente(s);
    motivo = exigir(motivo, 'Informe o motivo da recusa.');
    if (s.tipo === 'parceiro') pa.status = 'recusado';
    if (s.tipo === 'passeio_novo') Object.assign(passeioDe(s.passeio_id), { status: 'recusado', motivo_recusa: motivo });
    decidir(s, me, 'recusada', motivo);
    enviarEmail(pa?.email, `Não aprovado: ${tituloSol(s)}`, motivo);
    auditar(me, 'recusou solicitação', 'solicitacao', s.id, `${tituloSol(s)} · ${motivo}`);
  },
  pedirAjuste({ id, mensagem }, me) {
    const s = achar(db.solicitacoes, id, 'Solicitação');
    pendente(s);
    mensagem = exigir(mensagem, 'Escreva o que precisa mudar.');
    Object.assign(s, { status: 'aguardando_parceiro', mensagem });
    enviarEmail(parceiroDe(s.parceiro_id)?.email, `Ajuste necessário: ${tituloSol(s)}`, mensagem);
    auditar(me, 'pediu ajuste', 'solicitacao', s.id, `${tituloSol(s)} · ${mensagem}`);
  },
  // Sem id: cadastra um parceiro novo, já ativo (o acesso ao painel sai por "redefinirAcesso"). Com id: edita os dados.
  salvarParceiro({ id, campos = {} }, me) {
    const p = id ? achar(db.parceiros, id, 'Parceiro') : null, novo = {};
    if (campos.cidade_id !== undefined) campos = { ...campos, cidade: nomeCidade(campos.cidade_id) || '' };
    for (const k of ['nome', 'razao_social', 'documento', 'cadastur', 'responsavel', 'telefone', 'email', 'categoria', 'cidade', 'endereco', 'horario']) if (campos[k] !== undefined) novo[k] = texto(campos[k]);
    if (!p && campos.pix_chave !== undefined) novo.pix_chave = texto(campos.pix_chave, 100);
    const final = { ...(p || novoParceiro({})), ...novo };
    if (final.nome.length < 2) falha('Informe o nome do parceiro.');
    if (!EMAIL.test(final.email)) falha('E-mail inválido.');
    if (!ehCategoria(final.categoria)) falha('Categoria inválida.');
    if (!ehCidade(final.cidade)) falha('Escolha uma das cidades da Quarta Colônia.');
    if (p) {
      const mudaram = Object.keys(novo).filter(k => novo[k] !== p[k]);
      if (!mudaram.length) return { nada: true };
      Object.assign(p, novo);
      auditar(me, 'editou parceiro', 'parceiro', p.id, 'Campos: ' + mudaram.join(', '));
      return { id: p.id };
    }
    const c = CIDADES.find(x => x.nome === final.cidade);
    const pa = novoParceiro({ lat: c.lat, lng: c.lng, ...novo, id: db.seq++, status: 'ativo' });
    db.parceiros.push(pa);
    auditar(me, 'cadastrou parceiro', 'parceiro', pa.id, pa.nome);
    return { id: pa.id };
  },
  // Suspenso, os passeios saem do site sozinhos (o site só mostra parceiro ativo) e voltam na reativação.
  suspenderParceiro({ id, motivo }, me) {
    const p = achar(db.parceiros, id, 'Parceiro');
    if (p.status !== 'ativo') falha('Só dá para suspender um parceiro ativo.');
    motivo = exigir(motivo, 'Informe o motivo.');
    Object.assign(p, { status: 'suspenso', motivo_status: motivo });
    enviarEmail(p.email, 'Conta suspensa', motivo);
    auditar(me, 'suspendeu parceiro', 'parceiro', p.id, motivo);
  },
  reativarParceiro({ id, motivo }, me) {
    const p = achar(db.parceiros, id, 'Parceiro');
    if (p.status !== 'suspenso') falha('Este parceiro não está suspenso.');
    motivo = exigir(motivo, 'Informe o motivo.');
    Object.assign(p, { status: 'ativo', motivo_status: '' });
    enviarEmail(p.email, 'Conta reativada', motivo);
    auditar(me, 'reativou parceiro', 'parceiro', p.id, motivo);
  },
  // pct em porcentagem (12.5 = 12,5%). Vale para as próximas reservas; as antigas guardam a comissão da compra.
  mudarComissao({ id, pct, motivo }, me) {
    const p = achar(db.parceiros, id, 'Parceiro'), novo = Math.round(+pct * 10) / 1000;
    if (!(novo >= 0 && novo <= 0.5)) falha('A comissão precisa ficar entre 0% e 50%.');
    motivo = exigir(motivo, 'Informe o motivo da mudança.');
    if (novo === p.comissao_pct) falha('A comissão já é essa.');
    db.comissoes_historico.push({ id: db.seq++, parceiro_id: p.id, de: p.comissao_pct, para: novo, motivo, por: me.nome, criado_em: iso() });
    const fmt = v => +(v * 100).toFixed(1) + '%';
    auditar(me, 'alterou comissão', 'parceiro', p.id, `${fmt(p.comissao_pct)} → ${fmt(novo)} · ${motivo}`);
    p.comissao_pct = novo;
  },
  // Destaque pago de um passeio (R$ 80 por 30 dias, descontado do repasse). desligar: o destaque ativo termina hoje.
  destacarPasseio({ id, inicio, fim, desligar }, me) {
    const ps = achar(db.passeios, id, 'Passeio'), hoje = ymd(Date.now()), atual = destaqueAtivo(ps.id, hoje);
    if (desligar) {
      if (!atual) falha('Este passeio não está em destaque.');
      atual.fim = hoje;
      return void auditar(me, 'desativou destaque pago', 'passeio', ps.id, `${ps.titulo} · ${atual.inicio} a ${hoje}`);
    }
    if (ps.status !== 'ativo') falha('Só dá para destacar um passeio aprovado.');
    if (!DATA.test(inicio) || !DATA.test(fim) || fim < inicio) falha('Escolha o início e o fim do destaque (o fim depois do início).');
    if (fim < hoje) falha('O fim do destaque já passou.');
    if (db.destaques.some(d => d.passeio_id === ps.id && d.inicio <= fim && inicio <= d.fim)) falha('Já existe um destaque deste passeio nessas datas.');
    db.destaques.push({ id: db.seq++, parceiro_id: ps.parceiro_id, passeio_id: ps.id, inicio, fim, valor_mensal: DESTAQUE_MENSAL, criado_em: iso() });
    auditar(me, 'ativou destaque pago', 'passeio', ps.id, `${ps.titulo} · ${inicio} a ${fim}`);
  },
  // Sem serviço de e-mail ainda: a senha provisória volta uma vez só, para o admin repassar ao responsável.
  // Parceiro cadastrado pelo admin ainda não tem conta: ela é criada aqui, com o e-mail do parceiro.
  redefinirAcesso({ id }, me) {
    const p = achar(db.parceiros, id, 'Parceiro'), senha_provisoria = crypto.randomBytes(6).toString('hex');
    let u = donoDe(p.id);
    if (!u) {
      const email = p.email.toLowerCase();
      if (db.users.some(x => x.email === email)) falha('O e-mail deste parceiro já é usado por outra conta. Troque o e-mail do parceiro antes.');
      u = { id: db.seq++, nome: p.responsavel || p.nome, email, perfil: 'operador', status: 'convidado', parceiro_id: p.id, papel: 'dono', criado_em: iso() };
      db.users.push(u);
    }
    u.senha = hash(senha_provisoria);
    sairDosOutros(u.id);
    enviarEmail(u.email, 'Acesso ao painel do parceiro', 'Sua senha foi redefinida pelo Viaje Mais. Entre com a senha provisória e troque em Configurações.');
    auditar(me, 'redefiniu acesso', 'parceiro', p.id, u.email);
    return { email: u.email, senha_provisoria };
  },
  // para: 'parceiro' (id do parceiro) ou 'turista' (id da reserva). Fica gravado como e-mail simulado.
  enviarMensagem({ para, id, assunto, texto: t }, me) {
    const r = para === 'turista' ? achar(db.reservas, id, 'Reserva') : null, p = para === 'parceiro' ? achar(db.parceiros, id, 'Parceiro') : null;
    if (!r && !p) falha('Escolha para quem vai a mensagem.');
    t = exigir(t, 'Escreva a mensagem.', 2000);
    assunto = texto(assunto, 120) || (r ? `Sobre a sua reserva ${r.codigo}` : 'Mensagem do Viaje Mais');
    const destino = r ? emailDoTurista(r) : p.email;
    if (!destino) falha('Esta conta foi excluída: não há para quem enviar.');
    enviarEmail(destino, assunto, t);
    auditar(me, r ? 'enviou mensagem ao turista' : 'enviou mensagem ao parceiro', r ? 'reserva' : 'parceiro', r ? r.id : p.id, assunto);
  },
  // O admin edita direto, sem solicitação (também troca a capa e remove fotos, mandando capa_id e fotos).
  editarPasseio({ id, campos }, me) {
    const ps = achar(db.passeios, id, 'Passeio'), c = limparPasseio(campos);
    if (c.fotos && c.capa_id === undefined && !c.fotos.some(f => f.id === ps.capa_id)) c.capa_id = c.fotos[0]?.id || null;
    const mudaram = Object.keys(c).filter(k => JSON.stringify(c[k]) !== JSON.stringify(ps[k]));
    if (!mudaram.length) return { nada: true };
    Object.assign(ps, c);
    auditar(me, 'editou passeio', 'passeio', ps.id, 'Campos: ' + mudaram.join(', '));
  },
  ocultarPasseio({ id, oculto }, me) {
    const ps = achar(db.passeios, id, 'Passeio');
    if (ps.status !== 'ativo') falha('Só dá para ocultar ou mostrar um passeio aprovado.');
    ps.oculto = !!oculto;
    auditar(me, ps.oculto ? 'ocultou passeio' : 'mostrou passeio', 'passeio', ps.id, ps.titulo);
  },
  // Regra da devolução: total até 3 h antes ou quando o parceiro/clima cancela; nada no no-show (só depois do horário).
  cancelarReserva({ id, motivo, obs }, me) {
    const r = achar(db.reservas, id, 'Reserva'), o = ofertaDe(r.oferta_id), falta = Date.parse(o.inicio) - Date.now();
    reservaAberta(r);
    const ROT = { cancelada_turista: 'Pedido do turista', cancelada_parceiro: 'Cancelado pelo parceiro', cancelada_clima: 'Cancelado por clima', no_show: 'No-show' };
    if (!ROT[motivo]) falha('Escolha o motivo.');
    if (motivo === 'no_show' && falta > 0) falha('Só dá para marcar no-show depois do horário do passeio.');
    const devolve = motivo === 'cancelada_parceiro' || motivo === 'cancelada_clima' || (motivo === 'cancelada_turista' && falta >= 3 * 36e5);
    if (motivo === 'no_show') r.status = 'no_show';
    else cancelar(r, motivo, texto(obs) || ROT[motivo], devolve);
    enviarEmail(emailDoTurista(r), `Reserva ${r.codigo}: ${ROT[motivo]}`, motivo === 'no_show' ? 'O passeio foi marcado como não comparecido.'
      : devolve ? 'Sua reserva foi cancelada. Se você já pagou, a devolução é total.' : 'Sua reserva foi cancelada, sem devolução (faltavam menos de 3 horas).');
    auditar(me, motivo === 'no_show' ? 'marcou no-show' : 'cancelou reserva', 'reserva', r.id, `${r.codigo} · ${ROT[motivo]}${motivo === 'no_show' ? '' : devolve ? ' · com devolução' : ' · sem devolução'}`);
    return { devolve };
  },
  // Outra saída do mesmo passeio, com vagas e a mais de 3 h. O valor pago continua o mesmo (preço travado na reserva).
  remarcarReserva({ id, oferta_id }, me) {
    const r = achar(db.reservas, id, 'Reserva'), novo = achar(db.ofertas, oferta_id, 'Saída'), antes = ofertaDe(r.oferta_id);
    reservaAberta(r);
    if (novo.id === antes.id) falha('Escolha uma saída diferente da atual.');
    if (novo.passeio_id !== r.passeio_id || novo.status !== 'ativa') falha('Escolha uma saída ativa do mesmo passeio.');
    if (Date.parse(novo.inicio) - Date.now() <= 3 * 36e5) falha('A nova saída precisa começar daqui a mais de 3 horas.');
    if (livres(novo) < r.pessoas) falha(`A nova saída não tem ${r.pessoas} vaga(s) livre(s).`);
    r.oferta_id = novo.id;
    const txt = `De ${quando(antes.inicio)} para ${quando(novo.inicio)}`;
    linhaDoTempo(r, 'Remarcada', txt);
    enviarEmail(emailDoTurista(r), `Reserva ${r.codigo} remarcada`, `Nova data: ${quando(novo.inicio)}.`);
    auditar(me, 'remarcou reserva', 'reserva', r.id, `${r.codigo}: ${txt}`);
  },
  reenviarVoucher({ id }, me) {
    const r = achar(db.reservas, id, 'Reserva');
    reservaAberta(r);
    enviarEmail(emailDoTurista(r), `Seu voucher ${r.codigo}`, `Voucher do passeio ${passeioDe(r.passeio_id)?.titulo} em ${quando(ofertaDe(r.oferta_id).inicio)}.`);
    linhaDoTempo(r, 'Voucher reenviado por e-mail', 'Pelo painel admin');
    auditar(me, 'reenviou voucher', 'reserva', r.id, r.codigo);
  },
  // Código novo (por exemplo, o antigo vazou). O código e o QR antigos deixam de valer.
  reemitirVoucher({ id }, me) {
    const r = achar(db.reservas, id, 'Reserva'), antigo = r.codigo;
    reservaAberta(r);
    let novo; do novo = cod(); while (db.reservas.some(x => x.codigo === novo || x.codigos_antigos.some(c => c.codigo === novo)));
    r.codigos_antigos.push({ codigo: antigo, emitido_em: r.voucher_emitido_em, motivo: `Reemitido: código novo ${novo}`, cancelado_em: iso() });
    Object.assign(r, { codigo: novo, voucher_emitido_em: iso() });
    linhaDoTempo(r, 'Voucher reemitido', `${antigo} → ${novo}`);
    enviarEmail(emailDoTurista(r), `Seu novo voucher ${novo}`, 'O código anterior foi invalidado.');
    auditar(me, 'reemitiu voucher', 'reserva', r.id, `${antigo} → ${novo}`);
    return { codigo: novo };
  },
  // O Pix do repasse é feito fora do app; aqui o admin registra que pagou. semana = segunda-feira da semana (AAAA-MM-DD).
  marcarRepassePago({ parceiro_id, semana, comprovante }, me) {
    const p = achar(db.parceiros, parceiro_id, 'Parceiro'), rep = repasses(p.id).find(x => x.semana_inicio === semana);
    if (!rep) falha('Repasse não encontrado.', 404);
    if (rep.status === 'aberto') falha('A semana ainda não terminou.');
    if (rep.status === 'pago') falha('Este repasse já está pago.');
    db.repasses_pagos.push({ id: db.seq++, parceiro_id: p.id, semana, valor: rep.liquido, pago_em: iso(), comprovante: texto(comprovante, 300) || null, por: me.nome });
    db.analises = db.analises.filter(a => !(a.parceiro_id === p.id && a.semana === semana));
    enviarEmail(p.email, 'Repasse pago', `O repasse da semana de ${semana} foi pago.`);
    auditar(me, 'marcou repasse pago', 'parceiro', p.id, `Semana de ${semana} · R$ ${rep.liquido.toFixed(2)}`);
  },
  // Denúncia do parceiro sobre uma avaliação: remover (sai da nota) ou manter.
  decidirDenuncia({ id, decisao, motivo }, me) {
    const a = achar(db.avaliacoes, id, 'Avaliação');
    if (a.denuncia?.status !== 'em_analise') falha('Esta avaliação não tem denúncia em análise.');
    if (!['remover', 'manter'].includes(decisao)) falha('Escolha remover ou manter.');
    Object.assign(a.denuncia, { status: decisao === 'remover' ? 'aceita' : 'recusada', decisao: texto(motivo, 400), decidido_em: iso() });
    a.removida = decisao === 'remover';
    enviarEmail(parceiroDe(a.parceiro_id)?.email, 'Denúncia de avaliação analisada', decisao === 'remover' ? 'A avaliação foi removida.' : 'A avaliação foi mantida.');
    auditar(me, decisao === 'remover' ? 'removeu avaliação' : 'manteve avaliação', 'avaliacao', a.id, texto(motivo, 200));
  },
};

module.exports = [
  { metodo: 'GET', caminho: '/api/admin/painel', quem: 'admin', fazer: ({ res, me }) => send(res, 200, visao(me)) },
  { metodo: 'POST', caminho: '/api/admin/acoes/:nome', quem: 'admin', fazer: ({ res, me, b, nome }) => {
    if (!Object.hasOwn(ACOES, nome)) return send(res, 404, { erro: 'Ação desconhecida.' });
    const r = ACOES[nome](b, me);
    save(); send(res, 200, r || {});
  } },
  // LGPD: o dado completo só sai por aqui, e cada acesso fica na auditoria. alvo_tipo: 'reserva' (contato do turista) ou 'parceiro' (Pix).
  { metodo: 'POST', caminho: '/api/admin/dados-pessoais', quem: 'admin', fazer: ({ res, me, b }) => {
    let dados;
    if (b.alvo_tipo === 'reserva') {
      const r = achar(db.reservas, b.alvo_id, 'Reserva');
      dados = { nome: r.nome, telefone: r.telefone, email: emailDoTurista(r) || '' };
    } else if (b.alvo_tipo === 'parceiro') {
      const p = achar(db.parceiros, b.alvo_id, 'Parceiro');
      dados = { pix_chave: p.pix_chave, pix_tipo: p.pix_tipo };
    } else return send(res, 400, { erro: 'Escolha de quem são os dados.' });
    auditar(me, 'viu dados pessoais', b.alvo_tipo, +b.alvo_id, texto(b.motivo, 200) || (b.alvo_tipo === 'parceiro' ? 'Chave Pix' : 'Contato do turista'));
    save(); send(res, 200, dados);
  } },
];
