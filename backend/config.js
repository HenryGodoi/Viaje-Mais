// Constantes do Viaje Mais. Mude aqui e vale para o servidor todo.
const path = require('path');

module.exports = {
  PORTA: process.env.PORT || 3000,
  // Pasta do repositório do Dashboard (painéis do admin e do operador). Por padrão, ao lado da pasta do site.
  DASHBOARD: process.env.DASHBOARD_DIR || path.join(__dirname, '..', '..', 'Dashboard'),
  // As mesmas categorias do Dashboard: [id gravado no banco, nome mostrado na tela].
  CATEGORIAS: [['cantina', 'Cantina'], ['vinicola', 'Vinícola'], ['restaurante', 'Restaurante'], ['museu', 'Museu'], ['trilha', 'Trilha'], ['guia', 'Guia'], ['hospedagem', 'Hospedagem']],
  // As 9 cidades da Quarta Colônia, com a cor de cada uma nos gráficos do admin.
  CIDADES: [
    { id: 'agudo', nome: 'Agudo', cor: '#9FD8EC', lat: -29.644, lng: -53.251 },
    { id: 'dona-francisca', nome: 'Dona Francisca', cor: '#3FBF8A', lat: -29.619, lng: -53.361 },
    { id: 'faxinal-do-soturno', nome: 'Faxinal do Soturno', cor: '#F2B05A', lat: -29.578, lng: -53.448 },
    { id: 'ivora', nome: 'Ivorá', cor: '#B794F4', lat: -29.523, lng: -53.584 },
    { id: 'nova-palma', nome: 'Nova Palma', cor: '#5BC0DE', lat: -29.471, lng: -53.469 },
    { id: 'pinhal-grande', nome: 'Pinhal Grande', cor: '#F687B3', lat: -29.345, lng: -53.32 },
    { id: 'restinga-seca', nome: 'Restinga Sêca', cor: '#E8E36B', lat: -29.813, lng: -53.374 },
    { id: 'sao-joao-do-polesine', nome: 'São João do Polêsine', cor: '#E9EEF7', lat: -29.619, lng: -53.443 },
    { id: 'silveira-martins', nome: 'Silveira Martins', cor: '#D97706', lat: -29.646, lng: -53.59 },
  ],
  COMISSAO_PADRAO: 0.15, // 15% de cada reserva; o admin pode mudar por parceiro
  DESTAQUE_MENSAL: 80,   // destaque pago: R$ 80 por 30 dias, descontado do repasse
  HORAS_ULTIMA: 2,       // faltando 2h ou menos: desconto máximo (última hora)
  HORAS_CANCELAR: 3,     // o viajante pode cancelar até 3h antes
};
