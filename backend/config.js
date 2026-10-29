// Constantes do Viaje Mais. Mude aqui e vale para o servidor todo.
module.exports = {
  PORTA: process.env.PORT || 3000,
  CATS: ['Natureza', 'Cultura', 'Vinícola', 'Trilha', 'Gastronomia'],
  HORAS_ULTIMA: 2,   // faltando 2h ou menos: desconto máximo (última hora)
  HORAS_CANCELAR: 3, // o viajante pode cancelar até 3h antes
};
