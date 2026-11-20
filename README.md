# Plataforma de Avaliação de Disciplinas

Desenvolvi esta plataforma durante o estágio obrigatório de Ciência da Computação na UniXS/UNISINOS. Os estudantes avaliam as disciplinas que cursam, professores consultam os resultados de suas turmas e a coordenação pode comparar períodos e acompanhar planos de melhoria.

## Tecnologias e arquitetura

| Camada | Tecnologias e responsabilidades |
| --- | --- |
| Frontend | React, TypeScript, Vite e CSS. Telas por perfil, gráficos e exportação em CSV. |
| Backend | Node.js, NestJS, TypeScript, TypeORM e PostgreSQL. A API REST usa Passport com JWT para autenticação e bcrypt para armazenar hashes de senhas. |
| Testes e documentação | Jest e NestJS Testing no backend, Node Test Runner no frontend, Oxlint, ESLint e Swagger/OpenAPI. |

O frontend consome a API REST. No backend, o código é dividido em módulos de autenticação, usuários, gestão acadêmica, questionários, avaliações, planos de melhoria e auditoria.

## Perfis e permissões

| Perfil | Acesso |
| --- | --- |
| `ADMIN` | Tem as permissões da coordenação e também cadastra usuários pela API. Pode excluir cursos, disciplinas, semestres, turmas, períodos e avaliações quando os vínculos permitem. |
| `COORDINATOR` | Gerencia dados acadêmicos, questionários, avaliações, habilitações e planos de melhoria. Consulta e exporta resultados e compara períodos. Pode excluir questionários quando os vínculos permitem. |
| `PROFESSOR` | Consulta as avaliações das próprias turmas e pode ver e exportar os resultados liberados. Consulta os planos atribuídos a ele e pode mudar a situação desses planos. |
| `STUDENT` | Consulta suas avaliações e responde às que estão abertas e para as quais tem habilitação. |

O login gera um JWT com validade de oito horas. A cada requisição autenticada, a API consulta a conta no PostgreSQL e usa o perfil atual para autorizar a operação. Contas inativas ou excluídas perdem o acesso mesmo com um token válido. O frontend guarda a sessão no `sessionStorage`.

## Gestão acadêmica e questionários

Cada disciplina pertence a um curso. Cada turma tem uma disciplina, um professor e um semestre. A turma pode ter uma avaliação por período de avaliação, com um questionário associado.

Os questionários organizam as perguntas por dimensão. Cada pergunta pode ser obrigatória ou opcional e ter formato de escala numérica (`SCALE`), escolha única (`SINGLE_CHOICE`) ou resposta discursiva (`TEXT`).

Uma nova escala tem limites inteiros entre −100 e 100. O máximo deve ser maior que o mínimo, com diferença de até 100 pontos. Perguntas de escolha única têm pelo menos duas opções, e respostas discursivas aceitam até 1.000 caracteres.

## Avaliações, elegibilidade e envio

1. O administrador ou coordenador cadastra o período, define o mínimo de respostas para divulgar a avaliação e habilita os estudantes ativos.
2. O estudante responde quando o período e o questionário estão ativos e o prazo de envio está aberto. A API verifica a habilitação, as perguntas obrigatórias e os valores enviados. Cada envio precisa ter pelo menos uma resposta, mesmo quando todas as perguntas são opcionais.
3. A API grava as respostas e marca a habilitação como concluída na mesma transação. Cada estudante pode enviar uma avaliação uma única vez.

## Anonimato e divulgação

As respostas ficam vinculadas à avaliação. A identidade do estudante e o registro de conclusão ficam na tabela de habilitações. O banco e os backups contêm as respostas originais e devem ter acesso restrito.

A API libera os resultados após o fim do período, quando a avaliação atinge o mínimo configurado de envios. Esse mínimo é de pelo menos dois e também vale para as respostas de cada pergunta, inclusive as opcionais. O backend verifica as permissões antes de divulgar os resultados.

| Estado da pergunta | O que aparece no resultado |
| --- | --- |
| `AVAILABLE` | Contagem e distribuição das respostas. Perguntas de escala também exibem a média. |
| `PROTECTED` | Identificação da pergunta e aviso de que o número de respostas ficou abaixo do mínimo. |
| `NO_RESPONSES` | Identificação da pergunta e indicação de que ela ficou sem respostas. |
| `COMMENTS_PROTECTED` | Identificação da pergunta e contagem das respostas discursivas quando o mínimo é atingido. Os comentários individuais ficam protegidos. |

O navegador gera o CSV a partir de `GET /evaluations/{evaluationId}/results`. O arquivo inclui dados da turma, participação e métricas liberadas. Os campos protegidos ficam vazios. Identificadores de estudantes e comentários individuais ficam fora da exportação.

## Análise de resultados e comparação histórica

Em **Análise de resultados**, administradores e coordenadores escolhem um período e podem usar **Comparar com** para ver os resultados lado a lado. Os filtros de curso, disciplina e professor valem para os dois períodos. O filtro de dimensão afeta apenas as perguntas de escala. Para calcular a participação, a API divide o total de envios pelo total de habilitações das avaliações com resultados liberados.

`GET /evaluations/analysis` exige `periodId` e aceita `comparisonPeriodId`, `courseId`, `disciplineId`, `professorId` e `dimensionId`. Os IDs são UUIDs. Para comparar, escolha períodos diferentes. Se informar curso e disciplina, a disciplina deve pertencer ao curso.

A comparação usa perguntas de escala com o mesmo ID e os mesmos limites nos dois períodos. A API verifica o mínimo por avaliação e por pergunta antes de reunir os resultados. Cada média é ponderada pelo número de respostas válidas. A tela informa quando um período está aberto, quando faltam resultados liberados ou quando não há perguntas compatíveis.

## Planos de melhoria

Administradores e coordenadores cadastram e editam planos com disciplina, problema, ação planejada, responsável e prazo. Podem vincular um período ou uma avaliação da mesma disciplina como origem. A listagem tem filtros por disciplina, situação, responsável e período de origem.

Todo plano começa como **Pendente** (`PENDING`). As outras situações são **Em andamento** (`IN_PROGRESS`) e **Concluída** (`COMPLETED`). O histórico registra o autor e a data do cadastro e de cada mudança de situação. Na tela **Meus planos de melhoria**, o professor pode consultar e mudar a situação dos planos atribuídos a ele.

Para acompanhar um plano, administradores e coordenadores podem escolher um período que comece após o fim do período de origem. Se o plano tiver uma avaliação de origem, ela é a única referência inicial. A comparação usa períodos encerrados e perguntas de escala compatíveis da mesma disciplina, com resultados liberados nos dois períodos. A tela mostra médias, contagens e diferenças entre os resultados.

- `GET /improvement-plans/{id}/comparison` aceita `periodId`. Se o parâmetro for omitido, usa o período já vinculado, quando houver. A resposta indica por que uma comparação está indisponível.
- `PATCH /improvement-plans/{id}/comparison` vincula um `periodId` com comparação disponível. Envie `null` para retirar o vínculo. A API também retira o vínculo se a origem mudar.

A API recalcula as métricas a cada consulta. O vínculo pode ser atualizado independentemente da situação do plano, e as diferenças entre períodos são descritivas.

## Auditoria administrativa

A tabela `administrative_audit_events` guarda o ID do usuário autenticado, a ação, o tipo e o ID do recurso, a data e a hora. Nas operações auditadas, a API grava a alteração e o evento na mesma transação. Se a gravação do evento falhar, a alteração é revertida.

- **Usuários** — cadastro pela API administrativa. Alterações diretas no banco e a criação pelo script do primeiro administrador ficam fora da auditoria. A API ainda não permite alterar perfil ou situação de uma conta.
- **Gestão acadêmica** — criação, edição e exclusão de cursos, disciplinas, semestres e turmas.
- **Questionários** — criação, edição e exclusão de questionários e cadastro de dimensões e perguntas. A API não oferece edição direta de dimensões e perguntas.
- **Avaliações** — criação, edição e exclusão de avaliações e períodos, alterações do mínimo de respostas e habilitação ou revogação. Os eventos de habilitação e revogação guardam o ID da avaliação, sem identificar o estudante ou a habilitação.
- **Planos de melhoria** — cadastro, edição e mudanças no vínculo de acompanhamento. As mudanças de situação ficam no histórico do próprio plano, inclusive quando feitas pelo professor.

Os eventos guardam apenas metadados da operação, sem senhas, hashes, tokens, respostas, comentários ou corpos de requisição. A consulta dos eventos é feita por quem tem acesso autorizado ao PostgreSQL. A API ainda não tem uma rota para listar eventos de auditoria.

## Instalação local

**Pré-requisito** — Use um banco PostgreSQL com o esquema já preparado. O repositório ainda não inclui migrações nem inicializa automaticamente um banco vazio.

Use Node.js 24, npm e PostgreSQL. A restauração foi testada no PostgreSQL 18.6.

```powershell
git clone https://github.com/gabriel-machado2005/avaliacao-disciplinas.git
cd avaliacao-disciplinas
npm --prefix backend ci
npm --prefix frontend ci
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
```

Preencha `backend/.env` com os dados de conexão do banco PostgreSQL e as configurações da API. Mantenha esse arquivo fora do Git.

| Variável | Valor ou finalidade |
| --- | --- |
| `DB_HOST` | Host do PostgreSQL. Em desenvolvimento local, `localhost`. |
| `DB_PORT` | Porta do PostgreSQL, normalmente `5432`. |
| `DB_DATABASE` | Nome do banco com o esquema da plataforma preparado. |
| `DB_USERNAME`, `DB_PASSWORD` | Usuário e senha do PostgreSQL. |
| `JWT_SECRET` | Segredo longo e aleatório para assinar tokens JWT. |
| `PORT` | Porta da API. O padrão é `3000`. |
| `NODE_ENV` | Em `production`, a documentação Swagger fica desabilitada. |
| `HTTPS_ENABLED` | `true` para HTTPS ou `false` para HTTP. Sem a variável, o modo HTTP é mantido. Configure em cada servidor. |
| `HTTPS_CERT_PATH`, `HTTPS_KEY_PATH` | Caminhos do certificado e da chave privada locais, exigidos quando HTTPS está habilitado. |
| `CORS_ORIGIN` | Origem permitida pelo backend. Por padrão, `http://localhost:5173` em HTTP e `https://localhost:5173` em HTTPS. |

Em `frontend/.env`, `VITE_API_BASE_URL` define a URL pública da API. Apenas essa variável tem prefixo `VITE_`; certificados, chaves e segredos não devem ser expostos ao navegador. Reinicie os servidores depois de alterar os arquivos de ambiente. A URL do frontend compilado é definida durante o build.

### Preparação do esquema PostgreSQL

O [AppModule](backend/src/app.module.ts) usa `synchronize: false` e `installExtensions: false` em todos os ambientes. Antes de iniciar o backend, prepare o esquema completo, incluindo a tabela `administrative_audit_events`, e instale a extensão `uuid-ossp` usada para gerar UUIDs.

O repositório ainda não inclui migrações versionadas, um esquema SQL completo ou um script para preparar um banco vazio. O script do primeiro administrador cria a conta em um banco com esquema existente. Backups com dados reais são reservados à recuperação autorizada e ficam fora do Git.

### Primeiro administrador

Com o esquema pronto, execute os comandos abaixo a partir da raiz do repositório. O script usa o banco configurado em `backend/.env` e cria a conta se ainda não houver um usuário com perfil `ADMIN`.

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

No modo HTTP, abra o [frontend](http://localhost:5173) no navegador. A API usa a porta `3000`, e o Vite mantém a porta `5173`, sem trocar automaticamente de porta se ela estiver ocupada. Os dois servidores escutam apenas em `localhost`. A URL da API é centralizada por `VITE_API_BASE_URL`; o backend autoriza somente a origem configurada em `CORS_ORIGIN`.

### HTTPS local

O HTTPS local foi validado em 20/11/2026 com certificados emitidos pelo mkcert e autoridade instalada no armazenamento de confiança do usuário no Windows. API, frontend, Swagger e documento OpenAPI responderam por HTTPS com TLS 1.3. O Brave reconheceu a conexão como segura.

A validação manual confirmou consultas autenticadas entre frontend e API por HTTPS, com JWT Bearer e sem requisições HTTP indevidas nos fluxos consultados. O CORS permitiu a origem configurada e não autorizou uma origem externa. Conexões com autoridade não confiável ou hostname incompatível foram rejeitadas, assim como acessos HTTP simples às portas HTTPS.

Use certificados de desenvolvimento emitidos pelo [mkcert](https://github.com/FiloSottile/mkcert). Depois de instalar a ferramenta, os comandos abaixo instalam sua autoridade local e geram um certificado para os endereços de loopback. Esse procedimento modifica o armazenamento de confiança do computador e deve ser feito conscientemente. Não sobrescreva certificados existentes.

```powershell
mkcert -install
$certDir = 'C:\Projetos\certificados-avaliacao-disciplinas'
New-Item -ItemType Directory -Path $certDir -Force | Out-Null
if ((Test-Path "$certDir\localhost.pem") -or (Test-Path "$certDir\localhost-key.pem")) {
    throw 'Os arquivos de certificado já existem; confira-os antes de continuar.'
}
mkcert -cert-file "$certDir\localhost.pem" -key-file "$certDir\localhost-key.pem" localhost 127.0.0.1 ::1
```

Em ambos os arquivos de ambiente locais, configure:

```dotenv
HTTPS_ENABLED=true
HTTPS_CERT_PATH=C:/Projetos/certificados-avaliacao-disciplinas/localhost.pem
HTTPS_KEY_PATH=C:/Projetos/certificados-avaliacao-disciplinas/localhost-key.pem
```

No backend, use `CORS_ORIGIN=https://localhost:5173`. No frontend, use `VITE_API_BASE_URL=https://localhost:3000`. Inicie os servidores com os mesmos comandos de desenvolvimento e abra `https://localhost:5173`. O Swagger estará em `https://localhost:3000/api/docs`, fora do modo de produção. Será necessário fazer login novamente, pois o `sessionStorage` é separado por origem.

O modo HTTPS interrompe a inicialização quando os arquivos não podem ser lidos, o certificado e a chave são inválidos ou incompatíveis, o certificado está fora da validade ou não inclui `localhost`. O Vite também rejeita uma API HTTP no modo HTTPS. Não há retorno silencioso para HTTP. O build do frontend não lê os certificados nem depende de sua existência.

O curl do Windows, usando Schannel, retornou `CRYPT_E_NO_REVOCATION_CHECK` ao tentar verificar a revogação do certificado local. Não foram usadas opções para ignorar revogação ou erros TLS. O Node com `--use-system-ca` validou a cadeia, a validade e o hostname usando as autoridades do Windows; o Brave também validou a conexão sem desabilitar TLS.

Com a autoridade confiável e a API em execução, a consulta abaixo permite repetir a verificação pelo Node.js 24:

```powershell
node --use-system-ca -e "require('node:https').get('https://localhost:3000/', response => { console.log(response.statusCode); response.resume(); }).on('error', error => { console.error(error.message); process.exitCode = 1; });"
```

Clientes Node também podem receber o certificado público da autoridade por `NODE_EXTRA_CA_CERTS`. Nunca desabilite a validação TLS. Mantenha os certificados fora do repositório e não compartilhe a chave da autoridade (`rootCA-key.pem`). Para voltar ao HTTP local, use `HTTPS_ENABLED=false`, `CORS_ORIGIN=http://localhost:5173` e `VITE_API_BASE_URL=http://localhost:3000` nos respectivos ambientes.

O mkcert é destinado ao desenvolvimento. Uma implantação institucional requer certificados públicos ou institucionais, renovação e configuração própria do servidor ou proxy reverso; o servidor de desenvolvimento Vite não substitui essa infraestrutura.

### Swagger e OpenAPI

No modo HTTP de desenvolvimento, abra o [Swagger UI](http://localhost:3000/api/docs) ou o [OpenAPI em JSON](http://localhost:3000/api/docs-json). Com HTTPS habilitado, use o [Swagger UI seguro](https://localhost:3000/api/docs) ou o [JSON por HTTPS](https://localhost:3000/api/docs-json). Para testar uma rota protegida, faça login em `POST /auth/login` e cole o `accessToken` em **Authorize** no Swagger UI. O login e a rota raiz são públicos.

A especificação OpenAPI 3.0.0 tem 55 operações e 26 esquemas, com autenticação Bearer em 53 operações. A documentação descreve parâmetros, corpos de requisição e códigos de resposta. Os erros retornam `statusCode` e `message`, que pode ser uma lista quando há erros de validação.

Com `NODE_ENV=production`, o Swagger UI e o JSON ficam indisponíveis.

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

Os testes unitários do backend usam dependências simuladas. Os do frontend verificam o CSV, a proteção dos dados exportados, a situação dos períodos, a URL da API e a configuração do servidor local.

Na validação de 20/11/2026, os 480 testes automatizados passaram, sem falhas ou testes ignorados:

| Grupo | Testes aprovados | Organização |
| --- | --- | --- |
| Unitários do backend | 433 | 18 suítes |
| Integração HTTP | 7 | 2 suítes |
| Frontend | 40 | 4 arquivos |
| **Total** | **480** | |

Os builds e lints dos dois projetos passaram; o lint do backend manteve três avisos em testes existentes. O build do frontend também passou com HTTPS habilitado e caminhos de certificados inexistentes. Os testes de configuração não instalam certificados; a confiança TLS foi conferida separadamente com certificados reais, Node e Brave.

### Testes HTTP

Os testes HTTP usam o `AppModule` e se conectam ao PostgreSQL. Configure as variáveis `DB_*` para uma instância descartável com o esquema pronto e defina um `JWT_SECRET` de teste.

```powershell
npm --prefix backend run test:e2e -- --runInBand
```

A suíte de auditoria precisa de uma instância PostgreSQL isolada com o esquema já preparado. Configure `DB_HOST=127.0.0.1`, `DB_PORT=55487`, `DB_DATABASE=unixs_audit_test` e `DB_USERNAME=unixs_audit_test`. A suíte só é habilitada quando `UNIXS_AUDIT_TEST_DATA_DIRECTORY` aponta para o diretório de dados da instância. Antes de iniciar a aplicação, ela confere a identidade do banco. As operações de teste usam dados fictícios.

Os sete testes HTTP passaram em duas suítes na validação de 20/11/2026. A instância isolada recebeu somente o esquema da plataforma, sem registros reais, e os testes criaram dados fictícios. Antes da execução, foram conferidos host, porta, banco, usuário e diretório de dados. A instância foi encerrada ao final. Os testes verificaram permissões, autoria das operações, proteção dos metadados e reversão de alterações em caso de falha na auditoria. O banco principal foi consultado somente para leitura, e suas contagens, hashes e estrutura permaneceram iguais.

### Testes de carga

Em 20/11/2026, foram aprovados 19 ensaios com k6 2.4.0: uma verificação inicial e três repetições de cada um dos outros seis cenários. Os **480 testes automatizados da plataforma**, os **37 testes automatizados dos scripts de carga** e os **19 ensaios de desempenho** são contabilizados separadamente.

| Cenário | Perfil de carga | Ensaios aprovados | Requisições | Submissões aceitas |
| --- | --- | ---: | ---: | ---: |
| 1 — Verificação inicial | 1 usuário virtual, 10 jornadas completas | 1 | 40 | 10 |
| 2 — Pico de login | 1, 2 e 5 logins/s, por 60 s em cada patamar | 3 | 1.444 | 0 |
| 3 — Consultas simultâneas | 5, 10 e 25 usuários virtuais, rampas de 15 s e patamares de 120 s | 3 | 15.537 | 0 |
| 4 — Jornada completa | 1, 2 e 5 jornadas/s por 120 s; depois 5/s por 300 s | 3 | 29.552 | 7.388 |
| 5 — Carga mista | 5 jornadas/s por 300 s, cinco leitores e dois gestores | 3 | 23.199 | 4.503 |
| 6 — Duplicidade concorrente | 100 estudantes por repetição, com cinco envios concorrentes por estudante e 10 usuários virtuais | 3 | 1.800 | 300 |
| 7 — Pico e recuperação | Rampa de 5 a 20 jornadas/s em 15 s, pico por 30 s, retorno a 5/s em 15 s e recuperação por 60 s | 3 | 15.296 | 3.824 |
| **Total** | | **19** | **86.868** | **16.025** |

Uma jornada completa inclui login, listagem das avaliações, carregamento do questionário e envio, com uma pausa de um segundo. Nos ensaios aprovados houve **zero erros inesperados** e **1.200 rejeições esperadas de duplicidade**. Cada grupo de cinco envios concorrentes teve um HTTP 201 e quatro HTTP 400 com a mensagem específica de avaliação já respondida. As verificações funcionais posteriores à carga não entram no total de requisições do k6.

#### Ambiente e critérios

A API independente usou `https://localhost:3001` e o PostgreSQL isolado usou `127.0.0.1:55487`, com banco e usuário exclusivos `unixs_load_test`. Os scripts conferem banco, usuário, porta, diretório de dados, processos e certificado antes das operações. Os dados são fictícios e ficam fora do Git. A validação TLS permaneceu ativa; o banco principal não foi acessado durante os testes de carga.

O computador tinha processador Intel Core Ultra 5 115U, oito núcleos físicos e dez processadores lógicos, 16 GB de RAM (15,50 GiB utilizáveis), SSD NVMe de 512 GB e Windows 11. Foram usados Node.js 24.21.0 e PostgreSQL 18.6, com `shared_buffers` de 128 MiB, `work_mem` de 4 MiB, limite de 100 conexões, `fsync` e `synchronous_commit` ativos. Gerador, API e banco compartilharam o mesmo computador.

| Operação | Média máxima | p95 máximo | p99 máximo |
| --- | ---: | ---: | ---: |
| Login | 1 s | 2 s | 3 s |
| Listagem e questionário | 500 ms | 1 s | 2 s |
| Envio | 1 s | 2 s | 4 s |
| Resultados e análise histórica | 1,5 s | 3 s | 5 s |

Além desses limites, a aprovação exige erros inesperados abaixo de 1%, todas as checagens funcionais corretas, nenhuma iteração descartada nos executores de chegada e conciliação dos envios com os registros persistidos. No cenário 4, os limites de latência valem para o patamar nominal. No cenário 7, valem para operações concluídas a partir de 90 s, incluindo a cauda de término das jornadas em curso.

Os cenários 2, 4 e 5 conciliam contagens por patamar e admitem no máximo uma chegada adicional na fronteira temporal de cada executor constante. Nenhuma requisição é descartada para ajustar o total. Contas e habilitações são separadas por patamar e repetição. A coleta interrompe o gerador se houver falha de medição, menos de 1 GiB de memória livre ou CPU global acima de 95% por mais de 30 s. A progressão para o cenário 7 depende da aprovação dos anteriores.

#### Desempenho observado

Todos os critérios aplicáveis passaram nos 19 ensaios aprovados. A tabela apresenta o **maior valor observado entre as três repetições** de cada métrica, em milissegundos. Não se calculou média de percentis; cada coluna pode corresponder a uma repetição diferente.

| Cenário e operação | Média | p95 | p99 |
| --- | ---: | ---: | ---: |
| 5 — Login | 81,33 | 101,79 | 113,01 |
| 5 — Listagem | 7,94 | 11,91 | 27,97 |
| 5 — Questionário | 7,17 | 12,38 | 21,31 |
| 5 — Envio | 29,38 | 43,76 | 62,83 |
| 5 — Resultados | 68,99 | 91,47 | 396,20 |
| 5 — Análise histórica | 187,70 | 216,83 | 240,41 |
| 7 — Login na recuperação | 77,10 | 95,51 | 102,62 |
| 7 — Listagem na recuperação | 5,73 | 9,43 | 11,19 |
| 7 — Questionário na recuperação | 6,10 | 10,38 | 13,08 |
| 7 — Envio na recuperação | 28,68 | 42,96 | 54,38 |

A carga mista processou de 25,34 a 25,51 requisições/s por repetição. O cenário 7 concluiu 1.275, 1.274 e 1.275 jornadas, com 42,09 a 42,15 requisições/s no ensaio inteiro, sem descartes e com recuperação dentro dos limites. Esses valores globais incluem rampas e recuperação; não representam o RPS exclusivo do patamar de 20 jornadas/s.

A CPU global máxima amostrada foi de 68%, e a memória livre mínima foi de 2,07 GiB. Não houve interrupção por recursos ou deadlocks nos ensaios aprovados. A conferência final validou 16 tabelas e 21 chaves estrangeiras, sem referências órfãs ou pares de respostas duplicados. Os envios confirmados corresponderam às submissões e elegibilidades concluídas; as verificações também cobriram permissões, anonimato, comentários protegidos e resultados abertos ou insuficientes.

#### Ocorrências e limites da validação

Os totais aprovados excluem três tentativas técnicas reprovadas: uma falha de conexão pela escolha IPv4/IPv6, uma asserção que esperava HTTP 200 no login em vez de 201 e uma execução com 483 logins rejeitada pelo critério inicial de exatamente 480. Esse último critério foi corrigido para considerar as fronteiras temporais, com contagem verificável por patamar. As evidências originais permanecem preservadas, sem aprovação retroativa.

Uma repetição do cenário 5 ficou inconclusiva por suspensão do Windows, confirmada pelos eventos Kernel-Power 506/507 e por uma lacuna de 208,43 s na coleta. Sem resumo final do k6, não há métricas completas dessa execução. Suas 509 submissões e 10.180 respostas foram preservadas e excluídas dos totais aprovados. Após o ajuste das configurações de energia, a repetição foi substituída por uma nova partição, e os oito ensaios restantes passaram, sem novas suspensões nas janelas medidas.

A base é sintética, com uma disciplina, três turmas e questionário de 20 perguntas; cresce entre partições, e os caches aquecem durante a campanha. A coleta de recursos é periódica, não contínua; o cenário 6 é curto e não permite concluir sobre seu pico real de recursos. Os contadores PostgreSQL são assíncronos e incluem o monitor, por isso não substituem a conferência SQL. Percentis com poucas amostras são indicativos, inclusive na recuperação. Não há métricas exclusivas do patamar máximo do cenário 7, ensaio de saturação máxima, teste prolongado, renderização React ou virada do prazo durante um envio. A verificação de anonimato não é um estudo de reidentificação temporal.

**Os resultados atendem aos perfis locais ensaiados e não comprovam a capacidade de uma infraestrutura institucional de produção.** Uma implantação exige repetir os testes com hardware, rede, volume de dados e metas próprios.

As instruções de preparação, execução sequencial, verificação e encerramento estão em [Testes locais de carga](tests/load/README.md). Elas exigem certificados confiáveis e uma exportação externa somente do esquema, sem dados reais; o repositório continua sem inicialização automática de banco vazio. Os relatórios completos, manifests de contas e evidências brutas ficam em armazenamento privado, fora do Git. Para testar apenas os scripts, sem iniciar carga:

```powershell
node --test tests/load/test/*.test.mjs
```

## Backup e restauração do PostgreSQL

Use versões de `pg_dump` e `pg_restore` compatíveis com o servidor.

1. Confirme o banco de origem e a porta. Com uma conexão somente leitura, use `pg_dump --format=custom --file=<novo-arquivo.backup.partial>`. Escolha um nome único em um diretório restrito, fora do Git, e confira o código de saída.
2. Leia o catálogo com `pg_restore --list <arquivo>`. No Windows, confira a leitura integral com `pg_restore --file=NUL <arquivo>`. Registre o tamanho e calcule o SHA-256 com `Get-FileHash -Algorithm SHA256`. Depois renomeie o arquivo para `.backup` e preserve as cópias anteriores.
3. Crie um banco vazio em uma instância PostgreSQL isolada, com porta diferente e diretório de dados próprio. Confirme o destino com `SELECT current_database(), inet_server_port(), current_setting('data_directory');`. Pare se algum valor estiver diferente do planejado.
4. Restaure o arquivo em uma transação com `pg_restore --exit-on-error --single-transaction --no-owner --no-acl --dbname=<conexão-do-destino-isolado> <arquivo.backup>`. No teste isolado, as opções `--no-owner` e `--no-acl` dispensam os proprietários e privilégios da origem. Use um prompt para credenciais ou um mecanismo de autenticação protegido.
5. Compare o esquema, as contagens das tabelas e os relacionamentos antes de testar operações de escrita. Use somente a cópia isolada no teste funcional, com `synchronize: false` e `installExtensions: false`. Encerre a instância ao terminar.

### Restauração verificada em 17/11/2026

O backup foi restaurado em uma instância isolada do PostgreSQL 18.6. A conferência usou o snapshot da origem exportado em uma transação somente leitura e passado a `pg_dump --snapshot`. O esquema, as contagens e os hashes dos registros coincidiram com os da origem.

| Item | Resultado |
| --- | --- |
| Backup | `avaliacao_disciplinas_20261117_114127_3a759ff0.backup` |
| Snapshot e tamanho | 11:41:28 no horário de Brasília, 41.374 bytes |
| SHA-256 | `C2266C5028D3097FBF46690FB34E74A8709CACEE593A52E2B812917C1BA59AE1` |
| Dados recuperados | 16 tabelas e 63 registros restaurados |
| Relacionamentos | 21 chaves estrangeiras validadas e zero referências órfãs |
| Auditoria administrativa | A tabela foi restaurada vazia. Os testes na cópia confirmaram que ações válidas geram eventos e requisições rejeitadas deixam a contagem de eventos intacta. |

O catálogo, a leitura integral do arquivo e o SHA-256 foram conferidos. O backup e o relatório de validação ficam em armazenamento restrito, fora do Git.

## Matriz de requisitos e evidências

A matriz segue as seções 1 a 11 da especificação da UniXS. A entrega acadêmica roda localmente em um banco com o esquema preparado. O HTTPS foi verificado nesse ambiente. Uma implantação institucional ainda exige certificados e infraestrutura HTTPS próprios de produção, mudanças do banco versionadas e testes da capacidade do ambiente.

| Seção e requisito | Classificação | Evidência ou limite |
| --- | --- | --- |
| 1–2 · Coleta, análise e questionários configuráveis | Atendido e verificado | Configuração de questionários, envio de respostas, consulta de resultados agregados e comparação. |
| 3, 10 e 11 · Perfis, painéis e controle de acesso | Atendido e verificado | Acesso por perfil e vínculo. Os testes cobrem mudanças de perfil e contas inativas ou excluídas. |
| 4 e 10 · Gestão acadêmica, períodos e questionários | Atendido e verificado | Cadastro de disciplinas, turmas e professores, uma das alternativas da especificação. Questionários com dimensões e validação de escalas. |
| 4 e 10 · Elegibilidade, janela de envio e submissão única | Atendido e verificado | Testes de habilitação, prazo, respostas obrigatórias, valores aceitos e envios duplicados. |
| 5 e 10 · Separação da identidade e divulgação | Atendido e verificado | Identidade e respostas em tabelas separadas. Mínimo de respostas por avaliação e por pergunta. Comentários individuais protegidos. |
| 6, 9 e 10 · Resultados por perfil, gráficos e CSV | Atendido e verificado | Consulta por turma para o professor, gráficos de resultados agregados e testes dos campos protegidos no CSV. |
| 7 e 10 · Filtros da coordenação e histórico | Atendido e verificado | Testes de filtros, períodos, mínimo de respostas, médias ponderadas e compatibilidade das perguntas. |
| 8 e 10 · Ações e acompanhamento de melhoria | Atendido e verificado | Cadastro, atribuição e histórico dos planos. Os testes da comparação cobrem acesso, origem, período e divulgação. |
| 11 · Auditoria administrativa | Atendido e verificado | Testes em instância isolada cobrem autoria, metadados, proteção, rejeições e reversão. O cadastro pelo script e as alterações diretas no banco ficam fora da trilha. |
| 11 · Comunicação segura | Atendido e verificado em ambiente local | Certificados confiáveis, TLS 1.3, CORS e consultas autenticadas por HTTPS validados com Node e Brave em 20/11/2026. A implantação institucional exige certificados e infraestrutura próprios de produção. |
| 11 · Responsividade, usabilidade e acessibilidade | Parcialmente atendido | Telas principais verificadas em desktop e celular. A cobertura de navegadores e a avaliação de acessibilidade ainda são limitadas. |
| 11 · Capacidade para picos de acesso | Atendido e verificado em ambiente local, nos perfis de carga ensaiados | Sete cenários com k6 e 19 ensaios aprovados: 86.868 requisições, 16.025 submissões aceitas e zero erros inesperados. Integridade, duplicidade, divulgação e recuperação verificadas. Os resultados não comprovam capacidade institucional de produção. |
| 11 · Arquitetura, testes, versionamento e API | Atendido e verificado | Separação por camadas, versionamento com Git, testes automatizados e documentação OpenAPI. |
| 11 · Backup e restauração | Atendido e verificado | Restauração isolada de 17/11/2026 com 16 tabelas e teste da auditoria na cópia. |
| Implantação institucional · Migrações versionadas | Não atendido | A sincronização do esquema e a instalação de extensões estão desabilitadas na inicialização. Falta um procedimento versionado para criar e atualizar o esquema. |
| 6 · Agrupamento de comentários com processamento de linguagem natural | Melhoria futura | A especificação trata o recurso como complementar. Hoje a divulgação inclui somente a contagem autorizada de respostas discursivas. |
| Evolução analítica · Equivalência entre versões de questionários | Melhoria futura | A comparação exige perguntas com o mesmo ID e limites de escala. A composição das turmas pode variar entre períodos. |
