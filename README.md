# Plataforma de Avaliação de Disciplinas

Sistema web desenvolvido para gerenciar avaliações de disciplinas acadêmicas, permitindo que estudantes respondam questionários e que professores e gestores consultem resultados consolidados.

O projeto foi desenvolvido como parte das atividades de estágio supervisionado, com foco no desenvolvimento de aplicações web, integração com banco de dados e implementação de regras de negócio.

## Tecnologias utilizadas

### Backend

- Node.js
- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- JWT para autenticação
- Jest para testes automatizados

### Frontend

- React
- TypeScript
- Vite
- CSS

### Ferramentas de desenvolvimento

- Visual Studio Code
- Git e GitHub
- Postman
- pgAdmin

## Funcionalidades

A plataforma possui quatro perfis de acesso.

### Administrador

- Gerenciamento de cursos, disciplinas, semestres e turmas.
- Cadastro de períodos de avaliação.
- Criação e gerenciamento de questionários.
- Cadastro de dimensões e perguntas.
- Criação de avaliações para as turmas.
- Habilitação de estudantes.
- Consulta dos resultados consolidados.

### Coordenador

- Acesso às funcionalidades acadêmicas e de gerenciamento de avaliações permitidas ao perfil.
- Consulta de resultados consolidados.

### Professor

- Consulta das avaliações vinculadas às suas turmas.
- Visualização dos resultados das avaliações autorizadas.

### Estudante

- Consulta das avaliações disponíveis.
- Visualização do estado de cada avaliação.
- Preenchimento de questionários durante o período permitido.
- Envio das respostas.
- Identificação das avaliações já respondidas.

## Questionários

Os questionários são organizados em dimensões e permitem três tipos de perguntas:

- **Escala numérica:** respostas dentro de um intervalo configurado.
- **Escolha única:** seleção de uma alternativa entre as opções cadastradas.
- **Resposta aberta:** preenchimento de um campo de texto.

As perguntas podem ser configuradas como obrigatórias ou opcionais.

## Regras de negócio

O sistema implementa validações para manter a consistência das avaliações.

Entre as principais regras estão:

- Uma turma não pode possuir avaliações duplicadas no mesmo período.
- Apenas estudantes ativos e habilitados podem responder.
- Cada estudante pode concluir uma avaliação uma única vez.
- As respostas são aceitas somente durante o período permitido.
- Perguntas obrigatórias precisam ser respondidas.
- Valores e alternativas enviados devem respeitar as configurações do questionário.
- Os resultados somente são liberados após o encerramento do período e quando a quantidade mínima de respostas é atingida.
- Professores podem consultar resultados apenas das turmas às quais estão vinculados.

As submissões são armazenadas sem associação direta ao identificador do estudante. O controle de conclusão é realizado separadamente, por meio da elegibilidade.

## Estrutura do projeto

```text
avaliacao-disciplinas/
├── backend/
│   ├── src/
│   │   ├── academic/
│   │   ├── auth/
│   │   ├── evaluations/
│   │   ├── questionnaires/
│   │   ├── scripts/
│   │   │   └── create-first-admin.ts
│   │   └── users/
│   └── .env.example
├── frontend/
│   └── src/
├── .gitignore
└── README.md
```

## Requisitos para execução

Para executar o projeto localmente, são necessários:

- Node.js e npm.
- PostgreSQL.
- Banco de dados e usuário configurados para a aplicação.
- Variáveis de ambiente do backend configuradas.

As credenciais do banco de dados e os segredos de autenticação devem permanecer fora do controle de versão.

## Instalação e execução

Clone o repositório:

```bash
git clone https://github.com/gabriel-machado2005/avaliacao-disciplinas.git
cd avaliacao-disciplinas
```

### Backend

Na pasta principal do projeto, instale as dependências do backend:

```bash
npm --prefix backend install
```

### Configuração das variáveis de ambiente

O backend utiliza variáveis de ambiente para configurar a conexão com o PostgreSQL e a autenticação JWT.

Na pasta `backend`, crie o arquivo `.env` a partir do modelo fornecido:

```powershell
Copy-Item backend/.env.example backend/.env
```

Abra o arquivo `.env` e configure as variáveis:

```dotenv
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=seu_usuario
DB_PASSWORD=sua_senha
DB_DATABASE=avaliacao_disciplinas
JWT_SECRET=substitua-por-um-segredo-longo-e-aleatorio
```

Antes de iniciar a aplicação, certifique-se de que:

- O PostgreSQL esteja instalado e em execução.
- O banco de dados informado em `DB_DATABASE` já exista.
- O usuário configurado tenha permissão para acessar o banco.
- O valor de `JWT_SECRET` tenha sido substituído por um segredo forte e aleatório.

O arquivo `.env` contém configurações sensíveis e não deve ser enviado ao GitHub. Ele está incluído no `.gitignore`.

O arquivo `.env.example` contém apenas valores ilustrativos e pode ser versionado normalmente.

**Observação:** durante o desenvolvimento, o TypeORM utiliza `synchronize: true`, permitindo a sincronização automática das entidades com o banco de dados. Essa configuração não deve ser utilizada em produção sem uma estratégia adequada de migrações.

### Criação do primeiro administrador

Em uma instalação nova, é necessário cadastrar um administrador inicial para acessar a plataforma e gerenciar os demais usuários.

Como a rota de cadastro de usuários exige autenticação com perfil `ADMIN`, o projeto disponibiliza um script de inicialização.

Antes de executá-lo, configure o PostgreSQL e as variáveis de ambiente do backend.

Na pasta `backend`, compile o projeto:

```powershell
cd backend
npm run build
```

Em seguida, informe os dados do administrador inicial no PowerShell:

```powershell
$env:BOOTSTRAP_ADMIN_NAME = Read-Host "Nome do administrador"
$env:BOOTSTRAP_ADMIN_EMAIL = Read-Host "E-mail do administrador"

$senha = Read-Host "Senha do administrador (mínimo de 12 caracteres)" -AsSecureString
$env:BOOTSTRAP_ADMIN_PASSWORD = [System.Net.NetworkCredential]::new("", $senha).Password
```

Execute o script:

```powershell
node .\dist\scripts\create-first-admin.js
```

Após a execução, remova as variáveis temporárias da sessão:

```powershell
Remove-Item Env:BOOTSTRAP_ADMIN_NAME, Env:BOOTSTRAP_ADMIN_EMAIL, Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
Remove-Variable senha -ErrorAction SilentlyContinue
```

Depois, retorne à pasta principal do projeto:

```powershell
cd ..
```

O script verifica se já existe algum usuário com perfil `ADMIN`. Se existir, nenhuma nova conta será criada.

Se não houver administradores, o script utilizará os dados informados para criar o primeiro usuário, armazenando a senha com hash bcrypt.

Esse procedimento deve ser executado apenas durante a configuração inicial, em um ambiente controlado.

Depois da criação, o administrador poderá acessar a plataforma com o e-mail e a senha configurados. O cadastro de outros usuários está disponível pela rota autenticada POST /users, acessível exclusivamente ao perfil ADMIN.

**Importante:** não coloque senhas reais no README, no `.env.example` ou em arquivos enviados ao GitHub.

Depois, inicie o servidor:

```bash
npm --prefix backend run start:dev
```

O backend utiliza, na configuração local de desenvolvimento, o endereço:

```text
http://localhost:3000
```

### Frontend

Em outro terminal, aberto na pasta principal do projeto, instale as dependências do frontend:

```bash
npm --prefix frontend install
```

Inicie a interface:

```bash
npm --prefix frontend run dev
```

O frontend utiliza, na configuração local de desenvolvimento, o endereço:

```text
http://localhost:5173
```

O backend e o frontend precisam estar em execução para utilizar a aplicação completa.

## Testes automatizados

O backend possui testes unitários desenvolvidos com Jest e NestJS Testing.

Os testes abrangem os módulos de:

- Autenticação.
- Usuários.
- Gerenciamento acadêmico.
- Questionários.
- Avaliações.

Para executar todos os testes:

```bash
npm --prefix backend test -- --runInBand
```

Resultado registrado durante a validação do projeto:

```text
Test Suites: 11 passed, 11 total
Tests:       131 passed, 131 total
```

Os testes unitários utilizam dependências simuladas para verificar os comportamentos dos serviços e controllers.

## Build de produção

Para verificar a compilação do backend:

```bash
npm --prefix backend run build
```

Para gerar a versão de produção do frontend:

```bash
npm --prefix frontend run build
```

Ambas as compilações foram executadas com sucesso durante a validação do projeto.

## Segurança e privacidade

A aplicação utiliza autenticação JWT e controle de permissões conforme o perfil do usuário.

O acesso aos resultados segue regras relacionadas ao perfil autorizado, ao encerramento do período de avaliação e à quantidade mínima de respostas.

O sistema também separa o registro de conclusão da avaliação do armazenamento das respostas, buscando reduzir a associação direta entre os estudantes e suas submissões.

## Sobre o projeto

Projeto acadêmico desenvolvido durante o estágio supervisionado em Ciência da Computação, com o objetivo de aplicar conhecimentos de desenvolvimento web, APIs REST, modelagem de dados, autenticação, testes automatizados e versionamento de código.
