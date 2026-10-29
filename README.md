# Viaje Mais

PWA de turismo para a **Quarta Colônia (RS)**. Mostra as vagas que sobraram em passeios, museus, vinícolas e trilhas, com desconto: quanto mais vazio o horário, maior o desconto. O turista reserva pelo celular e recebe um código para usar no local, mesmo sem internet.

Projeto campeão do **Ideathon 2026**. Próxima etapa: Startcup.
Equipe: Henry Azambuja Godoi (desenvolvimento), Enzo Ueno e Samuel Fritz.

## O problema e a ideia

Passeios saem com vagas sobrando: o dono gasta o mesmo e ganha menos. Ao mesmo tempo, muitos turistas deixam de passear por achar caro. O Viaje Mais junta os dois lados, inspirado no app Primeira Mesa (descontos em restaurantes nos horários vazios), e reúne em um só lugar as atrações das nove cidades da região: Agudo, Dona Francisca, Faxinal do Soturno, Ivorá, Nova Palma, Pinhal Grande, Restinga Sêca, São João do Polêsine e Silveira Martins.

## Como rodar

Requisito: [Node.js](https://nodejs.org) 18 ou mais novo (usamos o 22 LTS). Não precisa instalar pacotes.

```bash
node server.js
```

Abra http://localhost:3000. No Windows, também dá para dar dois cliques em `INICIAR.bat`.

Para usar outra porta: `PORT=4000 node server.js` (no PowerShell: `$env:PORT=4000; node server.js`).

Na primeira execução o servidor cria o arquivo `db.json` com dados de demonstração. Para começar do zero, feche o servidor e apague esse arquivo.

### Contas de teste

| Perfil | E-mail | Senha |
|---|---|---|
| Administrador | `admin@viajemais.com` | `admin1234` |
| Operador de turismo | `operador@viajemais.com` | `operador1234` |
| Viajante | crie pela tela "Criar conta" | |

O operador de teste já tem o passeio aprovado "Rota dos fósseis".

### Roteiro para testar (fluxo do pitch)

1. Entre como **operador**, abra a aba Vagas e publique uma oferta (data futura, número de vagas, desconto máximo).
2. Em outra janela anônima, entre como **viajante**: veja a oferta, reserve e receba o código.
3. Volte ao operador, abra **Validar código** e digite o código. Usar o mesmo código de novo é recusado.

Dois perfis ao mesmo tempo precisam de navegadores ou janelas anônimas separadas: o login vale para todas as abas do mesmo navegador.

## O que já funciona

- **Página inicial** com o quadro "Próximas saídas": as próximas vagas reais aparecem mesmo sem login. A busca e cada saída levam ao login e, depois dele, direto para as ofertas filtradas ou para a oferta escolhida.
- **Desconto dinâmico:** `desconto = descontoMax × vagas livres ÷ vagas`. Faltando 2 horas ou menos, vai ao desconto máximo e aparece o selo "Última hora".
- **Reserva** de 1 a 10 pessoas, com nome e telefone. O preço fica travado no momento da reserva. Se as vagas acabarem durante a reserva, o app avisa.
- **Voucher** com código de 8 caracteres, salvo no aparelho para abrir sem internet.
- **Cancelamento** pelo viajante até 3 horas antes, com as vagas devolvidas à oferta.
- **Validação do código** pelo operador no local, uma única vez.
- **Três perfis:** viajante (ofertas, reservas, voucher), operador (passeios, vagas, validação) e administrador (aprova operadores e passeios).
- **Segurança:** senhas com scrypt e sal aleatório, sessão em cookie HttpOnly, validação de tudo no servidor e texto escapado na tela.
- **PWA:** instalável e com cache offline das telas.

## Estrutura

```
server.js              liga tudo: entrega as páginas e procura a rota da API
src/
  config.js            constantes (porta, categorias, 2h de última hora, 3h para cancelar)
  banco.js             db.json e dados de demonstração
  seguranca.js         senhas e código do voucher
  sessoes.js           login por cookie
  regras.js            cálculo do desconto
  rotas/               API: conta.js, passeios.js, ofertas.js
public/
  index.html           página inicial
  entrar.html          login e cadastro
  painel.html          área logada (viajante, operador, administrador)
  css/                 base.css (cores e fontes), home.css, app.css
  js/                  home.js, entrar.js, painel.js
  sw.js                service worker (cache offline)
```

Sem dependências: o servidor usa só módulos nativos do Node.js e os dados ficam num arquivo JSON. As rotas da API estão listadas nos arquivos de `src/rotas/`.

## Testar no celular

O PWA só instala em endereço seguro (HTTPS). No computador, `localhost` já funciona. Para abrir no celular, use o [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

e abra o endereço `https` que ele mostrar.

Depois de atualizar o código, aperte **Ctrl + Shift + R** no navegador para não ficar com a versão antiga guardada no cache.

## Ainda não feito

- Pagamento por Pix e QR code no voucher (hoje a reserva gera só o código).
- Entrar com Google (o botão existe, mas falta configurar o Client ID).
- Ofertas reais de última hora na página inicial e páginas por cidade e por roteiro.
- Newsletter, avaliações, avisos de última hora por notificação ou WhatsApp, pacotes passeio + jantar e painel de comissão.
- Para produção: banco de dados de verdade, HTTPS e recuperação de senha.
