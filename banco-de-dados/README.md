# banco-de-dados

O "banco" do Viaje Mais é um arquivo: `db.json`, nesta pasta. Não é um servidor de banco de dados. O backend lê o arquivo quando liga e regrava a cada mudança. Isso mantém o projeto sem dependências nesta fase; para produção, o plano é trocar por um banco de verdade.

O `db.json` **não vai para o GitHub**: ele tem senhas (com hash), telefones e fotos de quem se cadastrou. Cada computador tem o seu.

## Como usar

- **Primeiro uso:** se o arquivo não existir, o servidor cria um novo com as contas de teste (veja o README da raiz) e um passeio aprovado.
- **Começar do zero:** feche o servidor e apague o `db.json`.
- **Backup:** com o servidor fechado, copie o `db.json` para fora da pasta do projeto.
- **Não edite o arquivo à mão com o servidor ligado:** o servidor regrava o arquivo e a sua mudança se perde. Se o arquivo ficar com erro de formato, o servidor cria um banco de demonstração novo por cima dele e os dados antigos se perdem: faça backup antes de editar.

## Estrutura

`?` marca o campo que pode faltar.

| Coleção | Campos |
|---|---|
| `seq` | Próximo id. Um contador só, para todas as coleções |
| `users` | `id`, `nome`, `email`, `senha` (scrypt, no formato `sal:hash`), `perfil` (`cliente`, `operador` ou `admin`), `status` (`ativo` ou `pendente`), `telefone?`, `foto?` (imagem em data URL) |
| `passeios` | `id`, `operadorId` (→ users), `titulo`, `cidade`, `preco`, `categoria?` (sem ela vale Natureza), `descricao`, `status` (`pendente` ou `aprovado`) |
| `ofertas` | `id`, `passeioId` (→ passeios), `operadorId` (→ users), `inicio` (data e hora), `vagas`, `livres`, `descontoMax` (0 a 90) |
| `reservas` | `id`, `ofertaId` (→ ofertas), `clienteId` (→ users; `null` se a conta foi excluída), `pessoas`, `nome`, `telefone`, `desconto`, `precoUnit`, `total`, `codigo` (8 caracteres), `status` (`reservada`, `usada` ou `cancelada`), `criada`, `usadaEm?` |
| `favoritos` | `u` (id do usuário), `p` (id do passeio). Sobra da primeira versão |
