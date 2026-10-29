// Senhas (scrypt com sal aleatório) e códigos de voucher.
const crypto = require('crypto');

const hash = (s, salt = crypto.randomBytes(16).toString('hex')) => salt + ':' + crypto.scryptSync(s, salt, 32).toString('hex');
const check = (s, h) => { const [salt] = h.split(':'); return crypto.timingSafeEqual(Buffer.from(hash(s, salt)), Buffer.from(h)); };
// Código de 8 letras/números sem os que se confundem (0/O, 1/I/L).
const cod = () => Array.from(crypto.randomBytes(8), b => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[b % 31]).join('');

module.exports = { hash, check, cod };
