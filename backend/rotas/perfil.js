// Rotas do perfil: dados pessoais, foto, senha e exclusão da conta.
const { db, save } = require('../banco');
const { hash, check } = require('../seguranca');
const { sair, sairDosOutros } = require('../sessoes');
const { send } = require('../http');

// A foto chega já reduzida pelo navegador (data URL JPEG/PNG/WebP). Até ~220 KB de texto.
const FOTO = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/;
const MAX_FOTO = 300000;

module.exports = [
  // Nome, telefone e foto são do perfil do viajante. O nome do operador aparece para todos os viajantes
  // ("Oferecido por …") e não pode ser trocado por aqui, sem o admin saber. A troca de senha vale para todos.
  { metodo: 'POST', caminho: '/api/perfil', quem: 'cliente', fazer: ({ res, me, b }) => {
    const nome = String(b.nome || '').trim(), tel = String(b.telefone || '').trim(), dig = tel.replace(/\D/g, '');
    if (nome.length < 2) return send(res, 400, { erro: 'Informe seu nome completo.' });
    if (tel && (dig.length < 10 || dig.length > 13)) return send(res, 400, { erro: 'Informe um telefone com DDD ou deixe o campo vazio.' });
    me.nome = nome; me.telefone = tel; save();
    send(res, 200, { ok: true, nome, telefone: tel });
  } },

  { metodo: 'GET', caminho: '/api/perfil/foto', quem: 'cliente', fazer: ({ res, me }) => {
    if (!me.foto) return send(res, 404, { erro: 'Você ainda não tem foto.' });
    const [, tipo, dados] = me.foto.match(/^data:(image\/\w+);base64,(.+)$/);
    res.writeHead(200, { 'Content-Type': tipo, 'Cache-Control': 'private, no-cache' });
    res.end(Buffer.from(dados, 'base64'));
  } },
  { metodo: 'POST', caminho: '/api/perfil/foto', quem: 'cliente', fazer: ({ res, me, b }) => {
    if (b.foto === null) { delete me.foto; save(); return send(res, 200, { ok: true, temFoto: false }); }
    if (typeof b.foto !== 'string' || !FOTO.test(b.foto)) return send(res, 400, { erro: 'Escolha uma imagem JPG, PNG ou WebP.' });
    if (b.foto.length > MAX_FOTO) return send(res, 400, { erro: 'A foto ficou grande demais. Tente outra imagem.' });
    me.foto = b.foto; save(); send(res, 200, { ok: true, temFoto: true });
  } },

  { metodo: 'POST', caminho: '/api/perfil/senha', quem: 'logado', fazer: ({ res, me, tok, b }) => {
    if (!check(String(b.atual || ''), me.senha)) return send(res, 400, { erro: 'A senha atual não confere.' });
    if (String(b.nova || '').length < 8) return send(res, 400, { erro: 'A nova senha precisa ter ao menos 8 caracteres.' });
    if (b.nova !== b.confirmar) return send(res, 400, { erro: 'As senhas novas não são iguais.' });
    me.senha = hash(String(b.nova)); save(); // String(): uma senha enviada como número não pode dar erro 500
    sairDosOutros(me.id, tok); // quem estava logado com a senha antiga em outro aparelho precisa entrar de novo
    send(res, 200, { ok: true });
  } },

  // Só o viajante exclui a própria conta. Operador e admin têm passeios e aprovações ligados a eles.
  { metodo: 'DELETE', caminho: '/api/perfil', quem: 'cliente', fazer: ({ res, me, tok, b }) => {
    if (!check(String(b.senha || ''), me.senha)) return send(res, 400, { erro: 'Senha incorreta.' });
    const ativas = db.reservas.filter(r => r.clienteId === me.id && r.status === 'reservada' && new Date(db.ofertas.find(o => o.id === r.ofertaId)?.inicio) > new Date());
    if (ativas.length) return send(res, 409, { erro: `Você tem ${ativas.length} reserva(s) ativa(s). Cancele ou use antes de excluir a conta.` });
    // As reservas antigas ficam para o histórico do operador, mas sem os dados pessoais.
    for (const r of db.reservas) if (r.clienteId === me.id) { r.clienteId = null; r.nome = 'Conta excluída'; r.telefone = ''; }
    db.favoritos = db.favoritos.filter(f => f.u !== me.id);
    db.users = db.users.filter(u => u.id !== me.id); save();
    sairDosOutros(me.id); sair(res, tok);
    send(res, 200, { ok: true });
  } },
];
