// Formato dos registros do banco (o mesmo dos painéis do Dashboard) e ajudantes que não dependem do banco.
// Os campos novos de cada registro nascem aqui, para o cadastro, a migração e os dados de demonstração ficarem iguais.
const { CATEGORIAS, CIDADES, COMISSAO_PADRAO, HORAS_CANCELAR } = require('./config');

// Listas do db.json. versao 2 = formato do Dashboard (desde 02/11/2026).
const LISTAS = ['users', 'parceiros', 'passeios', 'ofertas', 'reservas', 'tentativas', 'solicitacoes', 'avaliacoes', 'destaques',
  'ajustes', 'analises', 'comissoes_historico', 'repasses_pagos', 'auditoria', 'emails', 'sessoes'];
// Frase que todo passeio ganhava sozinho antes de o parceiro escolher as horas (horas_cancelar): sai, para não contradizer a escolha.
const REGRA_ANTIGA = 'Cancelamento grátis até 3 horas antes. Depois disso, sem devolução.';
const garantir = db => {
  for (const k of LISTAS) db[k] ||= [];
  db.seq ||= 1;
  for (const p of db.passeios) { p.horas_cancelar ??= HORAS_CANCELAR; p.acessivel ??= false; if (p.regras_cancelamento === REGRA_ANTIGA) p.regras_cancelamento = ''; }
  return db;
};

const iso = (t = Date.now()) => new Date(t).toISOString();
const r2 = v => Math.round(v * 100) / 100;
const pad = n => String(n).padStart(2, '0');
const ymd = t => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);

const nomeCategoria = id => CATEGORIAS.find(c => c[0] === id)?.[1] || '';
const ehCategoria = id => CATEGORIAS.some(c => c[0] === id);
const ehCidade = nome => CIDADES.some(c => c.nome === nome);
const idCidade = nome => CIDADES.find(c => c.nome === nome)?.id || '';

// Dados pessoais que vão mascarados para os painéis (LGPD).
const nomeCurto = nome => { const [a = '', b] = String(nome || '').trim().split(/\s+/); return b ? `${a} ${b[0]}.` : a; };
const mascTelefone = t => {
  const d = String(t || '').replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '');
  return d.length < 10 ? '' : `(${d.slice(0, 2)}) ${d[2]}••••-•${d.slice(-3)}`;
};
const mascChave = k => !k ? '' : String(k).includes('@') ? String(k).replace(/^(.)[^@]*/, '$1•••••') : '•••••' + String(k).slice(-4);
const mascEmail = e => String(e || '').replace(/^(.)[^@]*/, '$1•••');

const novoParceiro = c => ({
  nome: '', razao_social: '', categoria: 'guia', cidade: '', endereco: '', lat: null, lng: null, telefone: '', email: '', documento: '',
  cadastur: '', horario: '', foto: null, comissao_pct: COMISSAO_PADRAO, pix_chave: '', pix_tipo: '', contrato: null,
  preferencias: {
    notificacoes: { reserva: { email: true, aparelho: true }, cancelamento: { email: true, aparelho: true }, repasse: { email: true, aparelho: false }, avaliacao: { email: false, aparelho: true } },
    som: true, vibracao: true, pos_sinc: 'perguntar'
  },
  status: 'ativo', motivo_status: '', criado_em: iso(), ...c
});

const novoPasseio = c => ({
  parceiro_id: null, titulo: '', cidade: '', categoria: 'guia', descricao: '', duracao_min: 120, ponto_encontro: '', lat: null, lng: null,
  capacidade: 10, preco: 0, desconto_max_padrao: 30, hora_padrao: '10:00', responsavel: '', inclui: '', levar: '', idiomas: 'Português',
  acessibilidade: '', acessivel: false, horas_cancelar: HORAS_CANCELAR, regras_cancelamento: '',
  fotos: [], capa_id: null, status: 'pendente', oculto: false, motivo_recusa: '', criado_em: iso(), ...c
});

// status: confirmada, validada, no_show, cancelada_turista, cancelada_parceiro, cancelada_clima.
// status_pagamento: 'pendente' enquanto não houver Pix no app (o turista paga no local).
// horas_cancelar: copiada do passeio quando a reserva é feita; mudar o passeio depois não muda a regra de quem já reservou.
// cancelado_motivo é o que o turista lê; cancelado_obs é a anotação interna do admin.
const novaReserva = c => ({
  observacoes: '', horas_cancelar: HORAS_CANCELAR, status: 'confirmada', status_pagamento: 'pendente', pago_em: null, validado_em: null, validado_por: '', aparelho: '', modo: '',
  sincronizado_em: null, pessoas_chegaram: null, aceito_com_aviso: '', cancelado_em: null, cancelado_motivo: '', cancelado_obs: '', reembolso: 0, codigos_antigos: [],
  historico: [], ...c
});

const novaSolicitacao = c => ({ passeio_id: null, campos: null, status: 'pendente', motivo: '', mensagem: '', decidido_em: null, decidido_por: '', criado_em: iso(), ...c });

module.exports = {
  LISTAS, garantir, iso, r2, ymd, texto, nomeCategoria, ehCategoria, ehCidade, idCidade,
  nomeCurto, mascTelefone, mascChave, mascEmail, novoParceiro, novoPasseio, novaReserva, novaSolicitacao
};
