// Troca a senha de qualquer conta direto no banco. Uso, com o servidor DESLIGADO, na raiz do projeto:
//   node backend/trocar-senha.js admin@viajemais.com minhaSenhaNova
// Com o servidor ligado não funciona: ele guarda o banco na memória e regrava o arquivo por cima.
const { db, save } = require('./banco');
const { hash } = require('./seguranca');

const [email, nova] = process.argv.slice(2);
if (!email || !nova) { console.log('Uso: node backend/trocar-senha.js <e-mail> <nova senha>'); process.exit(1); }
if (nova.length < 8) { console.log('A senha precisa ter ao menos 8 caracteres.'); process.exit(1); }
const u = db.users.find(x => x.email === email.trim().toLowerCase());
if (!u) { console.log('Nenhuma conta com o e-mail ' + email); process.exit(1); }
u.senha = hash(nova); save();
console.log(`Senha de ${u.email} trocada. Pode ligar o servidor.`);
