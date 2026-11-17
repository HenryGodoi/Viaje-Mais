// Funções que a home (home.js) e o painel (painel.js) usam. Carregar antes deles.
// Texto que vai para o HTML passa por esc(): sem isso, um nome com "<script>" rodaria na tela de outra pessoa.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
