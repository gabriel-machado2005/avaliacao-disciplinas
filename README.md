# Plataforma de Avaliação de Disciplinas

Projeto de estágio obrigatório em Ciência da Computação desenvolvido no contexto da UniXS/UNISINOS. A plataforma organiza a avaliação de disciplinas pelos estudantes, permite consultar resultados agregados e acompanha ações de melhoria ao longo dos períodos de avaliação.

## Tecnologias e arquitetura

| Camada | Tecnologias e responsabilidades |
| --- | --- |
| Frontend | React, TypeScript, Vite e CSS. Interface web responsiva com telas por perfil, gráficos e exportação CSV. |
| Backend | Node.js, NestJS, TypeScript, TypeORM, PostgreSQL, Passport/JWT e bcrypt. A API REST aplica a autorização, valida os dados e controla a divulgação. |
| Qualidade | Jest e NestJS Testing no backend, Node Test Runner no frontend, Oxlint e ESLint. A API é documentada com Swagger/OpenAPI. |

O backend organiza o código nos módulos de autenticação, usuários, gestão acadêmica, questionários, avaliações, Planos de Melhoria e auditoria administrativa. O frontend consome a API diretamente. O Git e o GitHub registram o versionamento do projeto.

## Perfis e permissões

| Perfil | Acesso |
| --- | --- |
| `ADMIN` | Cadastro de usuários pela API. Gestão acadêmica, questionários, avaliações, habilitações, resultados, análise histórica e Planos de Melhoria. Pode excluir cursos, disciplinas, semestres, turmas, períodos de avaliação e avaliações quando as regras de vínculo permitirem. |
| `COORDINATOR` | Gestão acadêmica, questionários, avaliações e habilitações. Consulta e exportação de resultados, análise histórica e gestão de Planos de Melhoria. A exclusão de questionários é compartilhada com `ADMIN` e respeita os vínculos existentes. |
| `PROFESSOR` | Consulta as avaliações e os resultados liberados das próprias turmas e pode exportá-los. Consulta os planos atribuídos a ele e atualiza a situação desses planos. |
| `STUDENT` | Consulta as próprias avaliações e responde ao questionário quando estiver habilitado e o envio estiver disponível. |

O login retorna um JWT com validade de oito horas. Em cada requisição autenticada, o backend consulta a conta no PostgreSQL e usa o perfil atual para autorizar operações. Contas inativas ou removidas perdem o acesso mesmo que o token ainda esteja dentro da validade. O navegador mantém a sessão em `sessionStorage`.

## Gestão acadêmica e questionários

- A base acadêmica inclui cursos, disciplinas, semestres e turmas. Cada turma tem uma disciplina, um professor e um semestre.
- Uma avaliação associa uma turma e um questionário a um período de avaliação. A mesma turma só pode ter uma avaliação por período.
- Os questionários agrupam perguntas em dimensões. As perguntas podem ser obrigatórias ou opcionais e usam três tipos: escala numérica (`SCALE`), escolha única (`SINGLE_CHOICE`) e resposta discursiva (`TEXT`).
- Os limites de uma nova escala são inteiros entre −100 e 100, com máximo maior que o mínimo e amplitude de até 100 pontos. A escolha única exige ao menos duas opções e textos de resposta têm limite de 1.000 caracteres.

## Avaliações, elegibilidade e envio

1. Um gestor cadastra o período, cria a avaliação com o mínimo de respostas para divulgação e habilita os estudantes ativos.
2. O estudante consulta as avaliações atribuídas a ele. O envio exige habilitação, período ativo e dentro da janela de resposta, questionário ativo, respostas obrigatórias preenchidas e valores compatíveis com as perguntas. A API exige ao menos uma resposta por envio, mesmo quando todas as perguntas são opcionais.
3. A API grava as respostas e marca a elegibilidade como concluída de forma transacional. Cada estudante pode concluir uma avaliação uma única vez.

## Anonimato e divulgação

A submissão tem vínculo com a avaliação. A identidade e a situação de conclusão do estudante ficam na elegibilidade, em uma tabela separada. O acesso ao banco e aos backups exige proteção própria, pois eles contêm os dados armazenados pela aplicação, incluindo as respostas originais.

A API libera os resultados depois do fim do período e quando a avaliação atinge o mínimo configurado de submissões, que deve ser de pelo menos duas. O mesmo limiar se aplica às respostas de cada pergunta, inclusive às opcionais. A autorização é verificada no backend. Professores só acessam resultados das próprias turmas.

| Estado da pergunta no detalhe | Conteúdo disponível |
| --- | --- |
| `AVAILABLE` | Contagem e distribuição para escala e escolha única. Escalas também exibem a média. |
| `PROTECTED` | Identificação e estado da pergunta. As métricas ficam protegidas por insuficiência de respostas. |
| `NO_RESPONSES` | Identificação e indicação de que a pergunta ficou sem respostas. |
| `COMMENTS_PROTECTED` | Identificação e quantidade de respostas discursivas quando o limiar foi atingido. Os comentários individuais permanecem protegidos. |

O CSV é gerado no navegador a partir da resposta de `GET /evaluations/{evaluationId}/results`. Inclui dados da turma, participação e as métricas autorizadas por pergunta. Os campos de métricas protegidas ficam vazios. O arquivo omite identificadores de estudantes e comentários individuais.

## Análise de resultados e comparação histórica

`ADMIN` e `COORDINATOR` podem abrir **Análise de resultados**, selecionar o período principal e, em **Comparar com**, escolher outro período. A API aplica os mesmos filtros de curso, disciplina e professor aos dois períodos. A dimensão filtra as perguntas de escala e a participação usa as avaliações divulgáveis do recorte. A taxa é calculada dividindo o total de submissões pelo total de habilitações.

`GET /evaluations/analysis` exige `periodId` e aceita `comparisonPeriodId`, `courseId`, `disciplineId`, `professorId` e `dimensionId`. Os IDs são UUIDs. Os períodos precisam ser distintos e a disciplina deve pertencer ao curso informado, quando ambos forem selecionados.

A comparação usa perguntas de escala com o mesmo ID, os mesmos limites e respostas divulgáveis nos dois períodos. O limiar é verificado por avaliação e por pergunta antes da agregação. A média é ponderada pelo número de respostas válidas. Períodos abertos ou sem resultados divulgáveis têm estados próprios, e a interface indica quando não há perguntas compatíveis. A API retorna indicadores agregados, sem dados individuais de estudantes ou comentários.

## Planos de Melhoria

`ADMIN` e `COORDINATOR` cadastram e editam planos pelo menu **Planos de melhoria**. Um plano inclui disciplina, problema, ação planejada, responsável e prazo. A origem pode ser um período ou uma avaliação da mesma disciplina. A listagem aceita filtros de disciplina, situação, responsável e período de origem.

Os planos iniciam como **Pendente** (`PENDING`) e também podem ficar **Em andamento** (`IN_PROGRESS`) ou **Concluída** (`COMPLETED`). O registro inicial e as mudanças de situação ficam no histórico com autor e data. Em **Meus planos de melhoria**, o professor só consulta e muda a situação dos planos atribuídos a ele. A API restringe o acesso ao plano e ao seu histórico.

No detalhe, `ADMIN` e `COORDINATOR` podem escolher um período de acompanhamento que comece após o encerramento da origem. Se a origem indicar uma avaliação específica, somente ela entra na referência inicial. O acompanhamento considera a mesma disciplina, períodos encerrados e perguntas de escala compatíveis com resultados divulgáveis nos dois recortes. A tela exibe médias, quantidades de respostas e variações descritivas.

- `GET /improvement-plans/{id}/comparison` aceita `periodId` opcional. Sem esse parâmetro, consulta o período vinculado, se existir. Em caso de indisponibilidade, responde com um estado explicativo, como ausência de origem, período aberto ou perguntas incompatíveis.
- `PATCH /improvement-plans/{id}/comparison` recebe um `periodId` com comparação disponível ou `null` para retirar o vínculo. Ao alterar a origem, a API remove o vínculo anterior.
- As métricas são recalculadas a cada consulta. O vínculo é independente da situação do plano e as variações observadas são descritivas.

## Auditoria administrativa

A tabela `administrative_audit_events` registra o ID do usuário autenticado, a ação, o tipo e o ID do recurso e a data e hora. Nas operações cobertas, a gravação do evento participa da mesma transação da alteração. Rejeições de autorização, falhas de validação e reversões não geram eventos de sucesso.

- **Usuários** — cadastro pela API administrativa. A API atual não possui rota para alterar perfil ou situação de uma conta. Alterações diretas no banco e a criação inicial pelo script de bootstrap estão fora da trilha.
- **Gestão acadêmica** — criação, edição e exclusão de cursos, disciplinas, semestres e turmas.
- **Questionários** — criação, edição e exclusão de questionários e cadastro de dimensões e perguntas. A API não oferece edição direta de dimensões e perguntas.
- **Avaliações** — criação, edição e exclusão de avaliações e períodos, alterações do mínimo de respostas e habilitação ou revogação. Nos eventos de elegibilidade, o recurso registrado é a avaliação. IDs de estudantes e de habilitações ficam fora desses eventos.
- **Planos de Melhoria** — criação, edição e alterações do vínculo de acompanhamento, incluindo a remoção decorrente de uma mudança de origem. As transições de situação continuam registradas no histórico próprio, inclusive quando realizadas pelo professor autorizado.

A trilha não registra senhas, hashes, tokens, respostas, comentários individuais ou corpos de requisição. A inspeção ocorre pelo acesso autorizado ao PostgreSQL. A API não oferece listagem de eventos de auditoria.

## Instalação local

Use Node.js 24 com npm e PostgreSQL. A versão do PostgreSQL usada na validação de recuperação foi a 18.6.

```powershell
git clone https://github.com/gabriel-machado2005/avaliacao-disciplinas.git
cd avaliacao-disciplinas
npm --prefix backend ci
npm --prefix frontend ci
Copy-Item backend/.env.example backend/.env
```

Para executar a aplicação, use um banco PostgreSQL local com o esquema da plataforma já preparado. Configure um usuário com acesso a esse banco e substitua os valores ilustrativos em `backend/.env`. Mantenha esse arquivo fora do Git.

| Variável | Valor ou finalidade |
| --- | --- |
| `DB_HOST` | Host do PostgreSQL. Em desenvolvimento local, `localhost`. |
| `DB_PORT` | Porta do PostgreSQL, normalmente `5432`. |
| `DB_DATABASE` | Nome do banco já preparado para a instalação. |
| `DB_USERNAME`, `DB_PASSWORD` | Credenciais do PostgreSQL, fornecidas localmente. |
| `JWT_SECRET` | Segredo de assinatura JWT, longo e aleatório. |
| `PORT` | Porta da API. O padrão é `3000`. |
| `NODE_ENV` | Em `production`, a documentação Swagger fica desabilitada. |

### Preparação do esquema PostgreSQL

O [AppModule](backend/src/app.module.ts) configura o TypeORM com `synchronize: false` e `installExtensions: false` em todos os ambientes. Prepare o esquema completo, incluindo a tabela `administrative_audit_events`, e disponibilize a extensão `uuid-ossp` usada na geração de UUIDs antes de iniciar o backend.

**Limitação de uma instalação nova** — O repositório ainda não inclui migrações versionadas, um esquema SQL completo ou um script para provisionar um banco vazio. Os arquivos atuais permitem configurar a conexão, executar o backend com um banco previamente preparado e criar a primeira conta administrativa. O script de criação dessa conta pressupõe o esquema existente. Os backups com dados reais são reservados à recuperação autorizada e ficam fora dos materiais de instalação e do Git.

### Primeiro administrador

Depois de preparar o esquema, execute o script no diretório `backend`. O comando usa o banco configurado em `.env` e cria um administrador somente se ainda não existir uma conta `ADMIN`.

```powershell
cd backend
npm run build
$env:BOOTSTRAP_ADMIN_NAME = Read-Host 'Nome do administrador'
$env:BOOTSTRAP_ADMIN_EMAIL = Read-Host 'E-mail do administrador'
$senha = Read-Host 'Senha do administrador (mínimo de 12 caracteres)' -AsSecureString
$env:BOOTSTRAP_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $senha).Password
try {
    node .\dist\scripts\create-first-admin.js
} finally {
    Remove-Item Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Variable senha -ErrorAction SilentlyContinue
}
cd ..
```

### Executar a aplicação

Com o banco preparado e as variáveis de ambiente configuradas, execute os comandos em terminais separados a partir da raiz do repositório.

```powershell
npm --prefix backend run start:dev
npm --prefix frontend run dev
```

Abra o [frontend](http://localhost:5173) no navegador. A configuração local do frontend usa a API em `http://localhost:3000`, e o backend autoriza via CORS a origem `http://localhost:5173`. Se mudar esses endereços, ajuste os pontos de configuração correspondentes.

### Documentação da API

Em desenvolvimento, abra o [Swagger UI](http://localhost:3000/api/docs) ou o [documento OpenAPI em JSON](http://localhost:3000/api/docs-json). Faça login em `POST /auth/login`, copie o `accessToken` e informe apenas o token em **Authorize** no Swagger UI. O esquema Bearer se aplica às rotas protegidas. O login e a rota raiz são públicos.

A documentação apresenta os corpos, filtros, UUIDs, valores enumerados e códigos de resposta por operação. Os erros retornam `statusCode` e `message`. Erros de validação podem retornar uma lista de mensagens. Em `NODE_ENV=production`, a interface e o JSON ficam indisponíveis.

No Passo 508, a validação do documento OpenAPI 3.0.0 conferiu 55 operações, 26 esquemas, os filtros analíticos e o Bearer nas 53 operações protegidas. A verificação HTTP foi executada com uma dependência de banco simulada.

## Testes, builds e lint

Execute a partir da raiz do repositório.

```powershell
npm --prefix backend test -- --runInBand
npm --prefix frontend test
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix backend run lint
npm --prefix frontend run lint
```

Os testes unitários do backend usam dependências simuladas. Os testes do frontend verificam o conteúdo e a privacidade do CSV. As suítes de `npm --prefix backend run test:e2e -- --runInBand` usam o `AppModule` e a configuração real do TypeORM. Antes de executá-las, aponte todas as variáveis `DB_*` para uma instância descartável com o esquema já preparado.

A suíte de auditoria roda quando `UNIXS_AUDIT_TEST_DATA_DIRECTORY` aponta para o diretório de dados da instância de teste. Ela confirma o diretório, o endereço `127.0.0.1:55487` e o banco `unixs_audit_test` antes de iniciar a aplicação com o usuário de teste `unixs_audit_test`. Os testes usam contas e dados fictícios.

Na validação final do Passo 509.2, foram aprovados 402 testes unitários do backend em 17 suítes, sete testes HTTP em duas suítes na cópia restaurada e três testes do frontend. A integração confirmou a identidade dos autores em requisições simultâneas, o escopo por perfil, a ausência de eventos em rejeições, a proteção dos dados e a reversão de uma alteração quando a auditoria falha.

## Backup e restauração do PostgreSQL

Use `pg_dump` e `pg_restore` em versão compatível com o servidor. O procedimento validado em 17/11/2026 usou PostgreSQL 18.6.

1. Crie um diretório de acesso restrito fora do Git e escolha um nome único para o arquivo. Conecte à origem somente para leitura e confirme o banco e a porta antes do dump. Use `pg_dump --format=custom --file=<novo-arquivo.backup.partial>` com destino exclusivo e verifique o código de saída.
2. Confira o catálogo com `pg_restore --list <arquivo>` e a leitura integral com `pg_restore --file=NUL <arquivo>` no Windows. Registre o tamanho e o SHA-256 com `Get-FileHash -Algorithm SHA256`. Após essas verificações, renomeie o arquivo temporário para `.backup`, preservando os backups anteriores.
3. Inicialize uma instância PostgreSQL temporária, com porta diferente e diretório de dados próprio, acessível apenas localmente. Crie um banco vazio nela e confirme a identidade com `SELECT current_database(), inet_server_port(), current_setting('data_directory');`. Interrompa a operação se qualquer valor divergir do destino planejado.
4. Execute a restauração em transação única, com `pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname=<conexão-do-destino-isolado> <arquivo.backup>`. Os proprietários e privilégios foram dispensados no teste de restauração. Use um prompt para credenciais ou um mecanismo de autenticação protegido.
5. Compare o esquema, as contagens por tabela e a integridade dos relacionamentos antes de executar testes que gravem dados. Na validação, `pg_dump --snapshot` e a comparação usaram o mesmo snapshot exportado de uma transação somente leitura, e o conteúdo das tabelas foi conferido por hash. Para o teste funcional, conecte o backend somente à cópia isolada com `synchronize: false` e `installExtensions: false`. Encerre a instância isolada depois das verificações.

### Validação final de 17/11/2026

| Item conferido | Resultado |
| --- | --- |
| Backup | `avaliacao_disciplinas_20261117_114127_3a759ff0.backup` |
| Diretório | `C:\Projetos\backups-avaliacao-disciplinas\validacao_20261117_114127_3a759ff0` |
| Snapshot e tamanho | 11:41:28 no horário de Brasília, 41.374 bytes |
| SHA-256 | `C2266C5028D3097FBF46690FB34E74A8709CACEE593A52E2B812917C1BA59AE1` |
| Destino da restauração | PostgreSQL isolado em `127.0.0.1:55487`, banco temporário `unixs_audit_test` |
| Esquema e registros | 16 tabelas e 63 registros restaurados. Esquema, contagens e conteúdo conferidos com a origem. |
| Relacionamentos | 21 chaves estrangeiras validadas e zero referências órfãs |
| Auditoria administrativa | A tabela foi restaurada com zero eventos. Os testes com dados fictícios na cópia isolada confirmaram gravação de eventos e ausência de eventos em requisições rejeitadas. |

O backup e o `relatorio-validacao.md` foram preservados no diretório indicado, fora do Git. O catálogo e a leitura integral passaram nas verificações, e o SHA-256 foi reconferido após a restauração. O relatório contém apenas evidências agregadas. O backup anterior foi preservado.

## Matriz de requisitos e evidências

A matriz segue as seções 1 a 11 das quatro páginas da especificação original da UniXS. A entrega acadêmica é executável localmente com um banco previamente preparado. A implantação institucional depende da configuração de comunicação segura, do controle de mudanças no banco e da validação de capacidade no ambiente de destino.

| Seção e requisito | Classificação | Evidência ou limite |
| --- | --- | --- |
| 1–2 · Coleta, análise e questionários configuráveis | Atendido e verificado | Fluxo integrado de configuração, envio, consulta agregada e comparação. |
| 3, 10 e 11 · Perfis, painéis e controle de acesso | Atendido e verificado | Guards, escopo por vínculo e testes de revalidação do perfil e de contas inativas ou excluídas. |
| 4 e 10 · Gestão acadêmica, períodos e questionários | Atendido e verificado | Cadastro de disciplinas, turmas e professores, organização por dimensões e validação de escalas. O cadastro satisfaz a alternativa de cadastro ou importação. |
| 4 e 10 · Elegibilidade, janela de envio e submissão única | Atendido e verificado | Testes de acesso, período, respostas obrigatórias, valores válidos e bloqueio de duplicidade. |
| 5 e 10 · Separação da identidade e divulgação | Atendido e verificado | Entidades separadas, mínimo configurável por avaliação aplicado também a cada pergunta e testes de proteção de comentários. |
| 6, 9 e 10 · Resultados por perfil, gráficos e CSV | Atendido e verificado | Consulta por turma para o professor, gráficos de indicadores agregados, testes de métricas autorizadas e campos protegidos no CSV. |
| 7 e 10 · Filtros da coordenação e histórico | Atendido e verificado | Testes de filtros, período, limiar, médias ponderadas e compatibilidade das perguntas. |
| 8 e 10 · Ações e acompanhamento de melhoria | Atendido e verificado | Planos, atribuição, histórico e comparação descritiva com resultados posteriores. Testes verificam escopo, origem, período e divulgação. |
| 11 · Auditoria administrativa | Atendido e verificado | Trilha persistente das operações HTTP administrativas cobertas. Integração isolada verificou autoria, metadados, proteção, rejeições e reversão. Bootstrap e operações externas à API possuem o limite descrito na seção de auditoria. |
| 11 · Comunicação segura | Não atendido | O ambiente local usa HTTP. HTTPS para frontend e API é requisito para implantação institucional. |
| 11 · Responsividade, usabilidade e acessibilidade | Parcialmente atendido | Layout responsivo e mensagens nas telas principais, com validações em desktop e celular. A cobertura de navegadores e a auditoria de acessibilidade ainda são limitadas. |
| 11 · Capacidade para picos de acesso | Parcialmente atendido | O envio usa transações e a análise agrega métricas em SQL. Há testes de regras e concorrência de autoria. A capacidade com volume de encerramento ainda não foi medida em teste de carga. |
| 11 · Arquitetura, testes, versionamento e API | Atendido e verificado | Separação de camadas, Git, suítes automatizadas e OpenAPI gerado e conferido. |
| 11 · Backup e restauração | Atendido e verificado | Restauração isolada final de 17/11/2026 com 16 tabelas e teste funcional da auditoria na cópia. |
| Implantação institucional · Migrations versionadas | Não atendido | A sincronização automática e a instalação automática de extensões estão desabilitadas. O repositório ainda carece de um procedimento versionado para criar o esquema e aplicar suas alterações. |
| 6 · Agrupamento de comentários com processamento de linguagem natural | Melhoria futura | A especificação o descreve como complementar. A divulgação atual usa somente a contagem autorizada de respostas discursivas. |
| Evolução analítica · Equivalência entre versões de questionários | Melhoria futura | A comparação atual exige o mesmo ID de pergunta e escala compatível. A composição das turmas pode mudar entre os recortes comparados. |
