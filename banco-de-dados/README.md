# banco-de-dados

O "banco" do Viaje Mais é um arquivo: `db.json`, nesta pasta. Não é um servidor de banco de dados. O backend lê o arquivo quando liga e regrava a cada mudança. Isso mantém o projeto sem dependências nesta fase; para produção, o plano é trocar por um banco de verdade.

Nada desta pasta vai para o GitHub, só este README. O `db.json` tem senhas (com hash), telefones e fotos de quem se cadastrou, e a `chave-voucher.json` é a chave que assina os vouchers. Cada computador tem os seus.

## Arquivos

| Arquivo | O que é |
|---|---|
| `db.json` | Os dados |
| `chave-voucher.json` | Chave privada que assina o QR dos vouchers. É criada sozinha na primeira reserva (a não ser que a variável `VOUCHER_CHAVE_PRIVADA` exista). **Não apague:** sem ela, os QR já emitidos deixam de ser aceitos (o código de 8 letras continua valendo) |
| `db-antes-da-migracao.json` | Cópia do banco no formato antigo, feita uma vez quando ele foi convertido |

## Como usar

- **Primeiro uso:** se o arquivo não existir, o servidor cria um com as contas de teste (veja o README da raiz), um parceiro, passeios aprovados e saídas futuras.
- **Começar do zero:** feche o servidor e apague o `db.json`.
- **Backup:** com o servidor fechado, copie o `db.json` e a `chave-voucher.json` para fora da pasta do projeto.
- **Não edite o arquivo à mão com o servidor ligado:** o servidor regrava o arquivo e a sua mudança se perde. Se o arquivo ficar com erro de formato, o servidor não liga e avisa no terminal. Nada é apagado.

## Formato antigo e conversão

Desde 02/11/2026 o banco usa o formato dos painéis do Dashboard (`"versao": 2`). Um `db.json` do formato antigo é convertido sozinho na primeira vez que o servidor novo liga, sem perder nada. Antes de converter, o servidor guarda a cópia `db-antes-da-migracao.json`.

Na conversão:

- **Operadores:** cada um vira o dono de um parceiro (a empresa). Operador pendente gera um pedido de aprovação.
- **Passeios:**
  - `aprovado` vira `ativo`;
  - o passeio pendente gera um pedido de aprovação;
  - as categorias antigas mudam assim: Vinícola → vinícola, Trilha → trilha, Gastronomia → restaurante, Cultura → museu, Natureza → trilha. Sem categoria, o passeio fica como guia.
- **Saídas:** ganham o preço do passeio. O campo `livres` some, porque agora é calculado das reservas.
- **Reservas:**
  - `reservada` vira `confirmada`, `usada` vira `validada` e `cancelada` vira `cancelada_turista`;
  - ganham os valores (cheio, pago, comissão de 15%, parte do parceiro);
  - a reserva cancelada fica sem comissão.
- **Favoritos:** saem, porque não eram usados.

## Estrutura

Os ids são números de um contador só (`seq`), para todas as coleções. Datas em texto ISO. `?` marca o campo que pode faltar.

| Coleção | Campos principais |
|---|---|
| `versao`, `seq` | Formato do banco (2) e próximo id |
| `users` | `id`, `nome`, `email`, `senha` (scrypt, `sal:hash`), `perfil` (`cliente`, `operador` ou `admin`), `status` (`ativo`, `pendente`, `convidado`), `parceiro_id?` e `papel?` (`dono` ou `validador`, só operador), `telefone?`, `foto?` (data URL), `criado_em` |
| `parceiros` | A empresa do operador: `id`, `nome`, `categoria`, `cidade` (nome), `endereco`, `lat`, `lng`, `telefone`, `email`, `documento`, `cadastur`, `horario`, `foto`, `comissao_pct` (0.15 = 15%), `pix_chave`, `pix_tipo`, `preferencias`, `status` (`pendente`, `ativo`, `suspenso`, `recusado`), `motivo_status` |
| `passeios` | `id`, `parceiro_id`, `titulo`, `cidade`, `categoria` (id: `cantina`, `vinicola`, `restaurante`, `museu`, `trilha`, `guia`, `hospedagem`), `descricao`, `preco` (sugerido para as saídas), `duracao_min`, `capacidade`, `desconto_max_padrao`, `hora_padrao`, `ponto_encontro`, `fotos` (`[{ id, url, tom }]`), `capa_id`, `status` (`pendente`, `ativo`, `recusado`), `oculto`, `motivo_recusa`, `acessivel` (`true`/`false`: o selo de acessibilidade no site), `horas_cancelar` (3, 12, 24 ou 48: o prazo do cancelamento grátis) e textos (`inclui`, `levar`, `idiomas`, `acessibilidade` e `regras_cancelamento`, que hoje guarda só as observações sobre o cancelamento) |
| `ofertas` | Cada saída: `id`, `passeio_id`, `parceiro_id`, `inicio`, `vagas`, `preco` (preço cheio desta saída), `desconto_max`, `responsavel`, `status` (`ativa`, `pausada`, `cancelada`), `motivo_cancelamento` |
| `reservas` | `id`, `codigo` (8 letras), `oferta_id`, `passeio_id`, `parceiro_id`, `turista_id` (`null` se a conta foi excluída), `nome`, `telefone`, `observacoes` (o que o turista escreveu ao reservar), `pessoas`, `horas_cancelar` (o prazo que valia quando a reserva foi feita), valores (`preco_unit`, `valor_cheio`, `desconto_pct`, `valor_pago`, `comissao_pct`, `comissao`, `valor_parceiro`, `reembolso`), `status` (`confirmada`, `validada`, `no_show`, `cancelada_turista`, `cancelada_parceiro`, `cancelada_clima`), `status_pagamento` (`pendente` enquanto não há Pix), validação (`validado_em`, `validado_por`, `aparelho`, `modo`, `pessoas_chegaram`, `aceito_com_aviso`), cancelamento (`cancelado_em`, `cancelado_motivo`, que o turista lê, e `cancelado_obs`, a anotação interna do admin), `voucher_emitido_em`, `codigos_antigos` (vouchers reemitidos), `historico` (a linha do tempo; remarcação, voucher reemitido e mensagem ao turista viram aviso no site) |
| `tentativas` | Validações recusadas: `codigo`, `motivo`, `reserva_id`, `usuario`, `aparelho`, `modo` |
| `solicitacoes` | Pedidos que esperam o admin: `tipo` (`parceiro`, `passeio_novo`, `alteracao_passeio`, `pix`), `parceiro_id`, `passeio_id`, `campos` (`{ preco: { de, para } }`), `status` (`pendente`, `aguardando_parceiro`, `aprovada`, `recusada`), `motivo`, `mensagem` |
| `avaliacoes` | `reserva_id`, `passeio_id`, `parceiro_id`, `turista_id`, `turista_nome`, `nota`, `comentario`, `resposta?`, `denuncia?`, `removida?` |
| `destaques` | Destaque pago de um passeio: `parceiro_id`, `passeio_id`, `inicio`, `fim` (AAAA-MM-DD), `valor_mensal` |
| `comissoes_historico` | Mudanças de comissão: `parceiro_id`, `de`, `para`, `motivo`, `por` |
| `repasses_pagos`, `analises`, `ajustes` | Repasse semanal: pagos (com comprovante), em análise e ajustes manuais (`semana` = segunda-feira, AAAA-MM-DD) |
| `sessoes` | Logins abertos: `token` (hash do cookie), `usuario_id`, `aparelho`, `ultimo_acesso`. Vencem com 30 dias sem uso |
| `auditoria` | O que o admin fez: `quem`, `acao`, `alvo_tipo`, `alvo_id`, `detalhe` |
| `emails` | Avisos que seriam enviados (`status: 'simulado'`, sem serviço de e-mail ainda) |
