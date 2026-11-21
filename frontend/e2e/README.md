# Validação de interface

Os testes usam o React real no Chromium e respostas fictícias da API. Não iniciam o backend nem acessam PostgreSQL. A API é configurada como `https://api.unixs-ui.invalid`; chamadas previstas são respondidas em memória. Qualquer outra API, método ou destino é bloqueado antes da rede e reprova o teste. O caso específico de bloqueio confere essa proteção, inclusive para a porta 3000. WebSockets e service workers também são bloqueados. Os únicos acessos reais são os arquivos do Vite local na porta 5174.

Essa simulação valida a interface dos perfis, não a autenticação JWT ou as permissões do backend. Credenciais, nomes, identificadores e respostas das fixtures são fictícios e não têm validade na aplicação.

## Preparação

Use Node.js 24, npm e os certificados locais confiáveis descritos na documentação principal. O Chromium do Playwright precisa confiar na autoridade local do computador. A validação TLS permanece ativa tanto no navegador quanto na verificação de disponibilidade do servidor; não use opções para ignorar certificados.

Na raiz do repositório:

```powershell
npm --prefix frontend ci
cd frontend
npx playwright install chromium
cd ..
```

Por padrão, o executor procura `localhost.pem` e `localhost-key.pem` no diretório `certificados-avaliacao-disciplinas`, ao lado do repositório. Para usar outro local, defina `UI_HTTPS_CERT_PATH` e `UI_HTTPS_KEY_PATH` no processo, sem versionar os arquivos ou modificar o ambiente da aplicação. O certificado deve incluir localhost e estar válido. A porta 5174 precisa estar livre; uma instância existente não é reutilizada.

## Execução

```powershell
npm --prefix frontend test
npm --prefix frontend run test:ui
```

Os 40 testes existentes do frontend continuam separados da suíte de navegador. A suíte tem 41 casos por largura, totalizando 246: os sete percursos de interface anteriores, 22 regressões de montagem/recarga, três de navegação com respostas pendentes, oito de login/logout por mouse ou teclado nos quatro perfis e uma regressão de substituição do módulo de foco. As regressões cobrem as dez seções administrativas de ADMIN e COORDINATOR, além de PROFESSOR e STUDENT. São usadas larguras de 360, 390, 768, 1024, 1366 e 1920 pixels CSS, com alturas de 844 pixels nos celulares e 900 nas demais larguras. O navegador tem locale pt-BR e o relógio fictício é fixado em 20/11/2026; não há mudança no relógio do Windows.

Para uma largura específica:

```powershell
npm --prefix frontend run test:ui -- --project=360px
```

O executor inicia e encerra somente seu Vite exclusivo por HTTPS. Os certificados não são copiados. Os arquivos `.env` da aplicação não são alterados; a URL fictícia da API e as opções do servidor de teste são fornecidas ao processo. Nenhum teste HTTP de integração com PostgreSQL é executado por esses comandos.

## Cobertura e evidências

- ADMIN e COORDINATOR: menu expandido/recolhido, cadastros acadêmicos, questionários/dimensões/perguntas, avaliações/resultados, análise histórica, planos, edição e comparação posterior.
- PROFESSOR: situações das avaliações, resultados, planos atribuídos, atualização de situação e histórico.
- STUDENT: listagem, questionário com escala/escolha/texto obrigatório e opcional, envio e retorno, além dos estados vazio e erro.
- Todos: limites horizontais da página e dos cartões para controles/indicadores, possibilidade de acionar botões, nomes acessíveis, hierarquia de títulos, contraste e demais verificações axe selecionadas.
- Teclado: login por Tab/Enter, controles nativos, menu recolhido fora da sequência de Tab, foco de chegada e retorno ao acionador quando ainda existe. Após enviar uma avaliação, o acionador deixa de existir e o foco retorna ao título da listagem.
- Montagem e F5: nenhum título recebe foco, inclusive após o carregamento assíncrono dos dados. Um registro de eventos detecta até focos transitórios nos títulos. Avaliações e Planos também são recarregados após navegação intencional com o título focado.
- Respostas pendentes: retorno de detalhes antes do término do carregamento, cancelamento da espera de foco e saída da sessão durante a carga. As respostas são retidas por uma barreira controlada, incluindo os efeitos duplicados do StrictMode; não há sleeps para simular essas condições. O teste também entra com outro perfil sem recarregar o documento.

O hook compartilhado registra a primeira tela sem mover o foco. Mudanças de tela posteriores dirigem o foco ao acionador lembrado ou ao título, aguardando sua montagem quando há dados assíncronos. A espera é cancelada ao sair da tela. Não existem exceções de foco inicial por perfil. A confirmação do questionário utiliza a mesma regra; os focos dos formulários acadêmicos ocorrem somente nos comandos explícitos de edição. Nenhum outline global foi removido.

O foco programático nos títulos acompanha a modalidade de entrada. Após interação por mouse, o título permanece como destino acessível sem contorno; o teclado mantém a indicação visual e a restaura ao ser retomado. A regra é compartilhada por todas as telas, inclusive durante respostas assíncronas. A exceção visual se limita aos títulos marcados pelo hook, é removida ao perderem foco e não afeta campos, botões ou acionadores restaurados. Os testes de autenticação verificam preenchimento seguido de clique, Tab/Enter, login, logout e retorno ao teclado.

As verificações de login usam eventos reais de mouse e registram os estilos calculados de outline, bordas e box-shadow, além dos estados de foco. O protocolo de depuração força também `:focus-visible` no título para testar a precedência da regra de ponteiro independentemente da heurística do navegador. Esse estado forçado é uma condição de teste, distinta do estado natural registrado e fotografado. Print Screen e atalhos do sistema/navegador não devem mudar a modalidade; Tab e teclas de navegação continuam mostrando o foco.

A regressão de atualização de módulo mantém a instância React e seus efeitos, troca a implementação do hook e confere o CSS calculado após novo clique e após Enter. Ela não modifica arquivos do projeto. Esse caso cobre a perda de modalidade encontrada com Fast Refresh: variáveis globais da nova instância do módulo não eram as mesmas usadas pelos listeners já instalados. A modalidade agora fica em um ref de cada instância do hook. A reprodução com HMR real no Vite e Brave foi feita separadamente, com API fictícia e sem alterar o conteúdo dos arquivos.

Cada estado auditado gera uma captura PNG da página inteira e um resultado axe em JSON. Falhas também preservam screenshot, contexto e trace. Há relatório HTML e JSON de resultados. Por padrão, o destino é uma pasta nova `unixs-ui-<timestamp>` no diretório temporário do usuário. Consulte `outputDir` no `results.json` do relatório para localizar as capturas. Para escolher um local persistente, defina `UI_ARTIFACTS_DIR` com um caminho absoluto fora do repositório antes de executar. Não publique os artefatos brutos.

Os testes falham se houver transbordamento ou violações axe nas regras WCAG 2 A/AA, 2.1 A/AA e boas práticas selecionadas. Resultados `incomplete` do axe são preservados e precisam de revisão; ausência de violações automáticas não certifica conformidade integral com WCAG.

Para abrir o relatório, execute em `frontend`, substituindo o caminho pelo diretório real da execução:

```powershell
npx playwright show-report 'C:\caminho-externo\da-execucao\report'
```

Na primeira execução de 20/11/2026, os 42 casos passaram, sem repetições automáticas ou casos ignorados. Foram produzidas 246 capturas e 246 verificações axe, sem violações ou itens inconclusivos nas regras selecionadas. Os 433 testes unitários do backend, sete HTTP em banco isolado e 40 testes existentes do frontend também passaram: 480 verificações existentes e 42 novas de navegador, totalizando 522. Os 37 testes dos scripts de carga e os ensaios de desempenho pertencem a outra campanha e não entram nesse total.

Na revisão centralizada do foco, também em 20/11/2026, passaram os 192 casos de navegador nas seis larguras, sem falhas, casos ignorados ou retries. As 378 verificações axe dessa execução não apontaram violações nem itens inconclusivos nas regras selecionadas. Os 40 testes existentes do frontend, build, lint e checagem TypeScript passaram novamente. São 232 testes executados nessa revisão; os testes do backend pertencem à validação anterior e não foram reexecutados. A revisão não acessou PostgreSQL nem alterou código do backend.

Na revisão do foco por modalidade de entrada, em 20/11/2026, passaram os 240 casos de navegador nas seis larguras, incluindo os 48 casos de autenticação por mouse e teclado. Não houve falhas, casos ignorados ou retries. As 474 verificações axe não apontaram violações nem itens inconclusivos. Os 40 testes existentes do frontend, build, lint e checagem TypeScript também passaram: 280 testes nessa revisão, sem reexecutar as suítes do backend ou acessar PostgreSQL.

Na revisão de Fast Refresh e do estilo renderizado, ainda em 20/11/2026, passaram os 246 casos de navegador nas seis larguras, sem falhas, casos ignorados ou retries. As 474 verificações axe ficaram sem violações ou itens inconclusivos. A nova regressão reproduziu a falha antes da correção e passou depois dela. Os 40 testes existentes do frontend, build, lint e checagem TypeScript também passaram: 286 testes nessa revisão. As capturas de PROFESSOR e STUDENT no Brave usaram API fictícia, após HMR real no Vite local. Nenhum teste dessa revisão utilizou o backend ou PostgreSQL.

## Conferência manual complementar

Na sessão habitual do navegador, o título pode apresentar contorno azul de foco após o login, desaparecendo após F5. Esse comportamento permanece como limitação visual conhecida e não impede o uso da plataforma. Os resultados automatizados em ambiente isolado não comprovam sua ausência em todas as configurações pessoais. Não foram realizados novos ajustes de foco para encerrar essa limitação.

Ainda é necessário verificar dispositivos reais, teclado virtual, seletores nativos, zoom real de 200%, leitura com tecnologia assistiva e outros navegadores. As capturas precisam de inspeção visual: a geometria e o acionamento automático não detectam todos os problemas de legibilidade ou sobreposição. Alterar a largura do viewport não substitui testar zoom do navegador. As restrições e permissões reais continuam sendo responsabilidade dos testes separados do backend.
