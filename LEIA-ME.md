# Viaje Mais — protótipo v5 (PWA)

Requisito: Node.js 18 ou mais novo. Não precisa instalar pacotes.

    node server.js          (ou dois cliques em INICIAR.bat no Windows)

Abra http://localhost:3000

## Contas de teste
- Administrador: admin@viajemais.com / admin1234
- Operador de turismo: operador@viajemais.com / operador1234  (já tem o passeio "Rota dos fósseis" aprovado)
- Viajante: crie pela aba "Criar conta"

## Fluxo do pitch para testar
1. Entre como operador > aba Vagas > publique uma oferta (data futura, vagas, desconto máximo).
2. Entre como viajante > veja a oferta, abra os detalhes e reserve > receba o código.
3. Entre como operador > aba Validar código > digite o código. Usar de novo é recusado.

## Regras já implementadas
- Desconto dinâmico: quanto mais vazio o horário, maior o desconto. Faltando 2h ou menos: desconto máximo (última hora).
- O preço da reserva fica fixo no valor do momento em que foi feita.
- Se as vagas acabarem durante a reserva, o app avisa.
- Cancelamento pelo viajante até 3h antes, com as vagas devolvidas.
- Voucher salvo no aparelho: abre sem internet (PWA).

## Ainda não feito
- Pagamento por Pix (hoje a reserva só gera o código), QR Code no voucher, avaliações.
- Avisos de última hora (notificação/WhatsApp), pacote passeio + jantar, comissão no painel do admin.
- Entrar com Google (falta o Client ID do Google Cloud).
- Para produção: banco de dados de verdade, HTTPS, recuperação de senha.

## Testar no celular como app
O PWA só instala em endereço seguro (HTTPS). No computador, localhost funciona.
Para o celular, use o ngrok: `ngrok http 3000` e abra o endereço https que ele mostrar.

## Novidade da v3: home verde ligada ao login

- `/` agora é a **home verde** (layout do Viaje Mais — Verde). A tela de login e cadastro passou para `/entrar.html`.
- Na home: **Entrar** leva ao login; **Planejar viagem**, **Buscar** e os cards de destino levam ao painel (que pede login se não houver sessão); **Começar agora** abre o cadastro direto.
- Se a pessoa já estiver logada, a home mostra **Meu painel** e **Ver ofertas**.
- **Sair** no painel volta para a home. Sessão expirada leva para `/entrar.html`.
- Textos entre colchetes ([Foto principal da região], [Depoimento do viajante] etc.) continuam como no layout, para serem preenchidos depois. O botão de newsletter ainda não grava nada.
- Importante: ao atualizar, aperte Ctrl+Shift+R (o cache do PWA foi renovado para a versão vm-v3).

## Novidade da v4: código organizado em pastas

Nada mudou para quem usa o site: as telas e as regras são as mesmas da v3. O que mudou foi a organização dos arquivos.

- O `server.js` ficou pequeno. As partes foram para `src/`: constantes em `config.js`, banco em `banco.js`, senhas e códigos em `seguranca.js`, login em `sessoes.js`, desconto em `regras.js` e as rotas da API em `src/rotas/` (conta, passeios, ofertas).
- O CSS e o JavaScript saíram de dentro dos HTML. Agora ficam em `public/css/` (`base.css` com as cores e fontes, `home.css`, `app.css`) e `public/js/` (`home.js`, `entrar.js`, `painel.js`).
- Para mudar uma cor do site todo, mude só em `public/css/base.css`.
- Se acontecer um erro inesperado numa rota, o servidor responde "Erro no servidor" em vez de cair.
- Importante: ao atualizar, aperte Ctrl+Shift+R (o cache do PWA foi renovado para a versão vm-v4).

## Novidade da v5: painel com a cara da home

As regras não mudaram; só o visual do painel (`painel.html`). A home e o login continuam iguais.

- Topo branco com o relógio, igual ao da home, e uma faixa verde com o título de cada tela. As abas ficam encaixadas na faixa.
- **Ofertas:** cada cartão mostra o desconto grande no selo verde, o selo "Última hora" quando faltam 2h ou menos, o preço antigo riscado e uma barra com as vagas que sobraram ("Restam 6 vagas de 10"). A barra mostra por que o desconto está daquele tamanho.
- **Detalhe da oferta:** resumo do desconto à esquerda e o formulário de reserva fixo à direita.
- **Voucher:** virou um ingresso, com o código grande. Reservas usadas ou canceladas ficam acinzentadas.
- **Operador:** formulário à esquerda e lista à direita, com a barra de vagas e o desconto de agora em cada oferta. Validar um código mostra uma caixa verde com o nome e o número de pessoas.
- **Admin:** listas de usuários e passeios, com o que aguarda aprovação destacado em amarelo.
- Telas vazias explicam o que fazer em seguida.
- Funciona no celular: as listas empilham e o selo do perfil some em telas bem estreitas.
- Importante: ao atualizar, aperte Ctrl+Shift+R (o cache do PWA foi renovado para a versão vm-v5).
