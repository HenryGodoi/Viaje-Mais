// Voucher assinado: o QR leva os dados da reserva e uma assinatura que só o servidor sabe fazer (ECDSA P-256 + SHA-256).
// O celular do operador confere a assinatura com a chave pública (GET /api/operador/dia), mesmo sem internet.
// Formato, igual ao do Dashboard: VM1.<dados em base64url>.<assinatura em base64url>
// A chave privada vem da variável de ambiente VOUCHER_CHAVE_PRIVADA (JWK). Sem ela, é criada uma e guardada em
// banco-de-dados/chave-voucher.json, que fica fora do git. Trocar a chave invalida os QR já emitidos.
const crypto = require('crypto'), fs = require('fs'), path = require('path');
const { PASTA } = require('./banco');

const ARQUIVO = path.join(PASTA, 'chave-voucher.json');
let privada, publica;
const chaves = () => {
  if (privada) return;
  let jwk = process.env.VOUCHER_CHAVE_PRIVADA || (fs.existsSync(ARQUIVO) && fs.readFileSync(ARQUIVO, 'utf8'));
  if (!jwk) {
    jwk = JSON.stringify(crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey.export({ format: 'jwk' }));
    fs.writeFileSync(ARQUIVO, jwk);
  }
  privada = crypto.createPrivateKey({ key: JSON.parse(jwk), format: 'jwk' });
  publica = crypto.createPublicKey(privada);
};
// ieee-p1363: o formato de assinatura que o crypto.subtle do navegador entende (o padrão do Node é outro).
const OPCOES = { dsaEncoding: 'ieee-p1363' };

const chavePublica = () => { chaves(); const { kty, crv, x, y } = publica.export({ format: 'jwk' }); return { kty, crv, x, y }; };
const assinar = dados => {
  chaves();
  const corpo = Buffer.from(JSON.stringify(dados));
  return `VM1.${corpo.toString('base64url')}.${crypto.sign('sha256', corpo, { key: privada, ...OPCOES }).toString('base64url')}`;
};
// Devolve os dados do QR se a assinatura confere; senão, null.
const conferir = qr => {
  chaves();
  const [v, c, s] = String(qr || '').split('.');
  if (v !== 'VM1' || !c || !s) return null;
  try {
    const corpo = Buffer.from(c, 'base64url');
    return crypto.verify('sha256', corpo, { key: publica, ...OPCOES }, Buffer.from(s, 'base64url')) ? JSON.parse(corpo) : null;
  } catch { return null; }
};

module.exports = { chavePublica, assinar, conferir };
