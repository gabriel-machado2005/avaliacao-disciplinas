# Testes locais de carga

Este conjunto mede a API NestJS e o PostgreSQL em um ambiente separado. Não mede renderização React nem comprova a capacidade de uma infraestrutura institucional.

## Destino permitido

- API: `https://localhost:3001`, com a mesma inicialização da plataforma.
- PostgreSQL: `127.0.0.1:55487`, banco e usuário `unixs_load_test`.
- Diretório: uma pasta nova `carga_<data>_<id>` em `C:\Projetos\certificados-avaliacao-disciplinas`, fora do Git e com as permissões restritas desse diretório.
- Certificados: `localhost.pem` e `localhost-key.pem` nesse diretório pai, emitidos por uma autoridade local confiável. A validação TLS permanece ativa.
- Esquema previamente preparado, com 16 tabelas. Não há migrations no projeto.

Os scripts não usam as credenciais do banco principal. Todas as variáveis de conexão do processo de teste são preenchidas explicitamente. Host, porta, banco, usuário, diretório, PIDs e certificado são conferidos antes de preparar ou executar o ensaio. Nenhuma rota de diagnóstico é adicionada à plataforma. O usuário exclusivo também administra esse cluster descartável; essa configuração não se destina à produção.

## Pré-requisitos

Use Windows, PowerShell, Node.js 24, dependências do backend instaladas e o backend compilado (`npm --prefix backend ci` e `npm --prefix backend run build`). Os scripts esperam os executáveis do PostgreSQL 18 em `C:\Program Files\PostgreSQL\18\bin`; esse caminho está definido em `environment.mjs`. A instalação oficial do [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) deve ocorrer fora do repositório. A campanha foi validada com k6 2.4.0. O executor aceita `--k6 <caminho>`; o padrão é o binário portátil dessa versão em `%LOCALAPPDATA%\Programs\k6\2.4.0\k6-v2.4.0-windows-amd64\k6.exe`.

O Node utiliza `--use-system-ca` para reconhecer a autoridade instalada no Windows. O k6 precisa reconhecer essa mesma autoridade em sua configuração padrão. Uma falha de confiança interrompe o teste; não use opções para ignorar TLS. O problema de revogação do curl/Schannel não é contornado por estes scripts.

É necessária uma exportação **somente de esquema**, sem registros reais, obtida de uma instalação autorizada com as 16 tabelas da plataforma. Esse SQL externo não acompanha o repositório, que ainda não possui migrations nem inicialização automática de banco vazio. O preparo recusa comandos de carga de dados, troca de banco ou exclusão no arquivo. Não use um backup com dados reais. Instalação de extensões e carga do esquema ocorrem somente após a identidade da nova instância ser conferida; `synchronize` permanece desabilitado.

Mantenha o diretório pai externo com acesso restrito ao usuário responsável e ao sistema, pois os scripts criam credenciais fictícias e um segredo JWT nele. As portas 3001 e 55487 precisam estar livres; não execute simultaneamente a integração HTTP, que também utiliza 55487. Confira os conflitos sem encerrar processos desconhecidos. Antes de medir, impeça a suspensão automática do Windows durante a campanha, mantenha alimentação estável e registre a configuração de energia e a carga de outros aplicativos.

## Preparação e cenário inicial

Execute na raiz do projeto. Escolha uma pasta nova e informe a localização real do arquivo SQL de esquema existente:

```powershell
$workspace = Join-Path 'C:\Projetos\certificados-avaliacao-disciplinas' ('carga_' + (Get-Date -Format 'yyyyMMddTHHmmss') + '_' + [Guid]::NewGuid().ToString('N').Substring(0,8))
$schema = Read-Host 'Caminho da exportação SQL somente de esquema'
node --use-system-ca tests/load/prepare.mjs --workspace $workspace --schema $schema
node --use-system-ca tests/load/run.mjs --workspace $workspace --scenario 1 --repetition 1
```

O preparo recusa diretórios existentes e portas ocupadas. Ele cria a instância PostgreSQL, verifica sua identidade, prepara somente fixtures e inicia a API. Arquivos privados e logs ficam no workspace. O usuário e o segredo JWT são exclusivos do teste. A aplicação das portas 3000/5173 e seus arquivos de ambiente permanecem intactos.

O executor identifica se a API está em `127.0.0.1` ou `::1` e seleciona a mesma família no resolvedor do k6. A URL e o hostname TLS continuam sendo `localhost`; o arquivo hosts do Windows não é alterado. Isso evita a preferência IPv4 do gerador quando o Node escuta apenas no loopback IPv6.

O conjunto comum contém 200 estudantes históricos e quatro contas de administração/professores, três turmas, questionário com 20 perguntas e períodos encerrados com resultados conhecidos. As fixtures históricas usam as entidades, como nos testes HTTP, sem ligar estudantes a submissões. Novas contas e elegibilidades usam os serviços existentes; a preparação fica fora da janela medida.

## Cenários e orçamento por repetição

| Nº | Perfil | Jornadas/envios planejados | Estudantes preparados |
| --- | --- | ---: | ---: |
| 1 | 1 VU, dez jornadas completas | 10 envios | 10 |
| 2 | Login: 1, 2 e 5 chegadas/s, 60 s cada | 480 logins | 576 |
| 3 | Leitores: 5, 10 e 25 VUs, 120 s por patamar e rampas de 15 s | Sem envio | 25 |
| 4 | 1, 2 e 5 jornadas/s por 120 s; depois 5/s por 300 s | 2.460 envios | 2.952 |
| 5 | 5 jornadas/s por 300 s, cinco leitores e dois gestores | 1.500 envios | 1.805 |
| 6 | 100 estudantes, cinco POSTs concorrentes para cada um | 100 aceitos e 400 rejeições esperadas | 100 |
| 7 | Rampa 5→20/s em 15 s, pico de 30 s, volta em 15 s, recuperação de 60 s | Até 1.276 envios | 1.532 |

As reservas dos perfis de chegada são de aproximadamente 20%. Leitores possuem contas separadas das contas consumidas por envios. Uma jornada corresponde a login, listagem, questionário e POST, com uma pausa de um segundo. Leituras pausam dois segundos; gestores pausam cinco.

Um ciclo completo reserva **7.000 estudantes**; três repetições completas reservam até **21.000**, além das 204 contas comuns. Para um cenário inicial e três repetições dos cenários 2 a 7, como nos 19 ensaios aprovados, são **20.980 estudantes**, além das contas comuns. Tentativas adicionais exigem novas reservas. As contas são criadas sob demanda, não todas no preparo. Cada par cenário/repetição possui uma partição própria (`s1_r1`, por exemplo), dados e marcador de consumo. Não reutilize uma partição, mesmo se o teste falhar. Use outra série ou outro workspace. O limite é de três repetições por cenário/série. Não há repetição automática, tentativas automáticas de submissão nem reciclagem de elegibilidades. Esgotamento do dataset interrompe o k6.

Para repetir uma campanha corrigida preservando a anterior, informe uma nova série, por exemplo `--series login_v2`. Isso cria `login_v2_s2_r1`, `login_v2_s2_r2` e `login_v2_s2_r3`, com novas contas e elegibilidades. O nome aceita até 24 letras minúsculas, números e sublinhados, começando por letra. Uma série existente não pode ser reutilizada para o mesmo cenário/repetição. Preparar três novas repetições do cenário 2 exige **1.728 novas contas**, além das contas de campanhas anteriores.

As reservas são separadas também por patamar. No cenário 2, os intervalos são `[0,72)`, `[72,216)` e `[216,576)`. Cada patamar recebe sua própria reserva de 20%. Uma iteração adicional não usa a conta do patamar seguinte; esgotar a reserva interrompe o teste antes de escolher outra conta. No cenário 4, os inícios passam a ser 0, 144, 432 e 1.152, preservando o orçamento de 2.952 contas. No cenário 5, as 1.800 contas do fluxo de envio continuam separadas das cinco contas leitoras.

Somente o cenário 1 pode ser executado sem confirmação adicional. Depois de autorizar um perfil mais intenso, use explicitamente:

```powershell
node --use-system-ca tests/load/run.mjs --workspace $workspace --scenario 4 --repetition 1 --allow-load
```

Esse comando é um exemplo de execução posterior, não faz parte da verificação inicial. Não há cenário de saturação máxima.

### Campanha sequencial

Depois de preparar um workspace novo e aprovar o cenário 1, execute os demais em ordem. O exemplo abaixo deve ser usado somente após autorizar a campanha. Ele verifica o código de saída e o relatório de cada repetição antes de avançar; o cenário 7 só começa se os anteriores passarem. Se o binário k6 estiver em outro local, acrescente `--k6 <caminho>` ao comando de execução.

```powershell
$series = 'campanha_' + (Get-Date -Format 'yyyyMMddHHmmss')
foreach ($scenario in 2..7) {
    foreach ($repetition in 1..3) {
        node --use-system-ca tests/load/run.mjs --workspace $workspace --scenario $scenario --repetition $repetition --series $series --allow-load
        if ($LASTEXITCODE -ne 0) {
            throw "Execução interrompida: cenário $scenario, repetição $repetition. Preserve as evidências."
        }
        $cohort = "${series}_s${scenario}_r${repetition}"
        $report = Get-Content -LiteralPath (Join-Path $workspace "$cohort\report.json") -Raw -ErrorAction Stop | ConvertFrom-Json -ErrorAction Stop
        if ($report.passed -ne $true) {
            throw "Relatório reprovado: $cohort. Não avance."
        }
    }
}
```

Mantenha a sessão do PowerShell aberta para preservar `$workspace`. A execução é sequencial; não rode campanhas em paralelo. Em caso de suspensão, falha da coleta, saturação do gerador ou relatório ausente, preserve a partição e classifique a execução sem inventar métricas. Investigue antes de retomar. Para substituir uma execução inconclusiva, use uma nova série apenas nos pares pendentes, sem executar novamente a campanha inteira ou reutilizar habilitações.

## Critérios e métricas

| Operação | Média máxima | p95 máximo | p99 máximo |
| --- | ---: | ---: | ---: |
| Login | 1 s | 2 s | 3 s |
| Listagem/questionário | 500 ms | 1 s | 2 s |
| Submissão | 1 s | 2 s | 4 s |
| Resultados/análise | 1,5 s | 3 s | 5 s |

O k6 avalia esses limites, taxa de erros inesperados menor que 1%, checagens funcionais corretas e ausência de chegadas descartadas. A duplicidade aceita somente um 201 e quatro 400 com a mensagem específica; outros 400 não são mascarados. No cenário 4 os limites de latência valem para o patamar nominal; no cenário 7, para operações concluídas a partir de 90 s (os últimos 30 s da recuperação e a cauda de `gracefulStop`). A API deve recuperar seus tempos nominais durante a janela de 60 segundos. Não há uma série separada exclusiva do patamar de pico.

O cenário 1 exige exatamente dez jornadas e dez submissões. Seus percentis têm poucas amostras e são apenas indicativos: ele não aprova a capacidade para picos. Os relatórios identificam operações com menos de 1.000 amostras. Para uma conclusão sobre p99, será necessário aumentar a amostragem e repetir o perfil nominal com bases equivalentes; não se deve calcular uma média dos percentis das repetições.

### Agendamento temporal e contagem por patamar

O [constant-arrival-rate](https://grafana.com/docs/k6/latest/using-k6/scenarios/executors/constant-arrival-rate/) controla chegadas por tempo, em modelo aberto. Ele não é um executor de quantidade fixa de iterações. Na implementação oficial do [k6 2.4.0](https://github.com/grafana/k6/blob/v2.4.0/lib/executor/constant_arrival_rate.go#L290-L338), o primeiro instante agendado é zero; o temporizador de uma chegada na fronteira disputa o encerramento do contexto de duração. Se essa chegada for iniciada, ela pode terminar durante o [gracefulStop](https://grafana.com/docs/k6/latest/using-k6/scenarios/concepts/graceful-stop/), que preserva iterações em andamento e não representa mais 30 segundos de carga.

A primeira execução do cenário 2 registrou 483 iterações, logins e requisições, sem erros, mas reprovou na exigência de exatamente 480. O mecanismo do executor explica a possibilidade de chegadas adicionais na fronteira. Os registros antigos não possuem eventos por patamar para atribuir individualmente cada uma das três chegadas adicionais; essa limitação histórica permanece registrada. Não houve repetição automática de HTTP nem submissões de avaliações nessa execução.

Foi aprovado para o **cenário 2** aceitar **60–61, 120–121 e 300–301 logins**, respectivamente, mantendo 1, 2 e 5 chegadas/s por 60 segundos cada, os mesmos VUs e `gracefulStop` de 30 segundos. São 480–483 no total, mas o total sozinho não aprova o teste. Essa faixa é um limite operacional do ensaio; não é uma garantia de contagem fornecida pelo k6. Qualquer patamar fora da faixa reprova.

Todas as chegadas são executadas e contadas: não há corte por `iterationInTest`, filtro de requisições tardias, redução artificial da duração ou cancelamento para fabricar uma quantidade. Por patamar, o verificador exige conciliação entre eventos, iterações nativas, jornadas iniciadas/concluídas, logins e requisições HTTP, além de zero iterações descartadas. Os limites de latência e erros continuam os mesmos. Eventos duplicados, ausentes, malformados ou com campos de identidade reprovam a conferência.

`stage-events.jsonl` registra apenas o nome do patamar, índice da iteração e milissegundos desde seu início, inclusive chegadas na fronteira. `arrival-accounting.json` reúne contagens, intervalos de contas, horários da primeira/última chegada e percentis por patamar. O log do k6 passa a ser estruturado e sem barra de progresso. A escrita dos eventos participa do custo do gerador; as latências HTTP continuam medidas pelo k6. Nenhum evento contém email, senha, token, ID de estudante ou ID de submissão.

O mesmo princípio foi aplicado aos cenários **4 e 5**, com autorização de no máximo uma chegada adicional por patamar de `constant-arrival-rate`. As faixas foram calculadas antes das execuções:

| Cenário/patamar | Taxa | Duração | Jornadas aceitas | Requisições do fluxo de envio | Reserva de contas |
| --- | ---: | ---: | ---: | ---: | ---: |
| 4 — first | 1/s | 120 s | 120–121 | 480–484 | 144 |
| 4 — second | 2/s | 120 s | 240–241 | 960–964 | 288 |
| 4 — third | 5/s | 120 s | 600–601 | 2.400–2.404 | 720 |
| 4 — nominal | 5/s | 300 s | 1.500–1.501 | 6.000–6.004 | 1.800 |
| 5 — students | 5/s | 300 s | 1.500–1.501 | 6.000–6.004 | 1.800 |

O cenário 4 aceita 2.460–2.464 jornadas por repetição, desde que cada patamar e todos os contadores estejam conciliados. Cada jornada contém quatro requisições e uma submissão completa. A conferência SQL exige exatamente uma submissão e 20 respostas por jornada efetivamente concluída, incluindo as chegadas de fronteira. O cenário 5 também possui cinco leitores e dois gestores, cujas quantidades de consultas variam com a duração das operações e permanecem separadas das 1.500–1.501 jornadas de envio. Não se aplica uma tolerância de apenas uma requisição ao total da carga mista.

As taxas, durações, pausas e limites de latência/erros não mudaram. No cenário 4, os limites de latência continuam aplicados ao patamar nominal. Nenhuma requisição é descartada para ajustar as quantidades. Contagens abaixo da faixa, mais de uma chegada adicional por patamar ou qualquer falha de conciliação reprovam a execução. Leituras por VUs/duração não receberam uma quantidade artificialmente fixa.

Os cenários 1 e 6 usam quantidade fixa de iterações; o cenário 3 mede consultas por duração. O cenário 7 usa [ramping-arrival-rate](https://github.com/grafana/k6/blob/v2.4.0/lib/executor/ramping_arrival_rate.go#L159-L265), também em modelo aberto, mas com cálculo finito pela área dos estágios e outro laço de agendamento. Seu critério e sua reserva não foram alterados.

Três repetições de cada cenário de 3 a 7 reservam, respectivamente, 75, 8.856, 5.415, 300 e 4.596 contas fictícias: **19.242 novas contas**, criadas sob demanda. O cenário 5 reserva ainda as duas contas de gestores já existentes nas fixtures comuns. Use uma série independente para a campanha; cada execução confere novamente a identidade do banco e da API. A progressão é sequencial e para diante de reprovação; o cenário 7 depende da aprovação de todas as repetições anteriores.

Exemplo de uma repetição do cenário 2 após autorização da campanha:

```powershell
node --use-system-ca tests/load/run.mjs --workspace $workspace --scenario 2 --repetition 1 --series login_v2 --allow-load
```

Na validação local de 20/11/2026, as três repetições da série `login_v2` foram aprovadas:

| Repetição | 1 login/s por 60 s | 2 logins/s por 60 s | 5 logins/s por 60 s | Requisições | Média global | p95 global | p99 global |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 61 | 120 | 301 | 482 | 88,04 ms | 118,60 ms | 140,53 ms |
| 2 | 60 | 120 | 300 | 480 | 92,10 ms | 128,74 ms | 153,10 ms |
| 3 | 61 | 121 | 300 | 482 | 89,75 ms | 122,22 ms | 145,60 ms |

Foram 1.444 requisições, sem erros ou iterações descartadas, com eventos e contadores conciliados em cada patamar. As chegadas adicionais registradas começaram em 60.000–60.001 ms desde o início de seus patamares. A variação entre repetições, com a mesma configuração, confirma a sensibilidade à fronteira temporal. Nenhuma requisição foi excluída. Os percentis são apresentados por repetição, sem calcular média entre eles; cada patamar tem poucas amostras para concluir sobre p99. Essa validação cobre o perfil local de login e não a capacidade dos demais cenários ou de uma instalação institucional.

### Resultados consolidados de 20/11/2026

A campanha completa reuniu um ensaio inicial aprovado e três repetições aprovadas de cada cenário 2 a 7. Os resultados anteriores foram preservados; a retomada executou somente as repetições 2 e 3 do cenário 5 e as três dos cenários 6 e 7, usando a série independente `resume_v1`.

| Cenário | Repetições aprovadas | Requisições por repetição | Submissões por repetição |
| --- | ---: | --- | --- |
| 1 — Verificação inicial | 1 | 40 | 10 |
| 2 — Pico de login | 3 | 482 / 480 / 482 | Sem envio |
| 3 — Consultas simultâneas | 3 | 5.183 / 5.177 / 5.177 | Sem envio |
| 4 — Jornada completa | 3 | 9.856 / 9.844 / 9.852 | 2.464 / 2.461 / 2.463 |
| 5 — Carga mista | 3 | 7.733 / 7.733 / 7.733 | 1.501 / 1.501 / 1.501 |
| 6 — Duplicidade concorrente | 3 | 600 / 600 / 600 | 100 / 100 / 100 |
| 7 — Pico e recuperação | 3 | 5.100 / 5.096 / 5.100 | 1.275 / 1.274 / 1.275 |

Os **19 ensaios aprovados** somaram **86.868 requisições** e **16.025 submissões aceitas**, com **zero erros inesperados** e **1.200 rejeições esperadas de duplicidade**. Cada repetição do cenário 6 gerou 100 logins e 500 POSTs: um aceite e quatro rejeições específicas por estudante. A recuperação do cenário 7 passou nas três repetições, sem iterações descartadas. As contagens e os percentis de cada repetição permanecem separados; não se faz média dos percentis.

Os **480 testes automatizados da plataforma**, os **37 testes dos scripts de carga** e os **19 ensaios de desempenho** são grupos diferentes. O [README principal](../../README.md#testes-de-carga) resume hardware, limites, latências, RPS, integridade e limitações da campanha. Foram amostrados até 68% de CPU global e no mínimo 2,07 GiB livres, sem acionamento dos limites de interrupção nos ensaios aprovados.

Três tentativas técnicas reprovadas ficam fora desses totais: `s1_r1` falhou pela família DNS incompatível; `s1_r2` esperava HTTP 200 no login em vez do 201 existente; `s2_r1` registrou 483 logins e reprovou no critério original de exatamente 480. Não houve aprovação retroativa, e os arquivos originais foram preservados. A verificação inicial aprovada é `s1_r3`; isso não representa três ensaios iniciais aprovados.

A segunda repetição do cenário 5 foi interrompida por suspensão do computador. Os eventos Kernel-Power 506/507 do Windows coincidiram com uma lacuna de 208,43 segundos na coleta de recursos, seguida de avisos EOF/timeouts. O resumo final do k6 não foi gerado; por isso não há métricas completas nem conciliação entre confirmações do cliente e registros persistidos. A execução é **inconclusiva** e seus registros foram preservados, sem aprovação ou repetição automática.

A conferência posterior encontrou 509 submissões completas e 10.180 respostas nessa partição, sem respostas parciais ou pares duplicados. A integridade estrutural, as 21 chaves estrangeiras, as permissões e as restrições de divulgação foram verificadas. Isso não substitui as métricas e confirmações ausentes do ensaio interrompido.

Após o ajuste das configurações de energia, `resume_v1_s5_r2` substituiu a repetição inconclusiva com dados novos. Essa repetição, `resume_v1_s5_r3` e as seis dos cenários 6 e 7 passaram. Não houve eventos de suspensão nas oito janelas medidas da retomada. Os 509 envios da partição interrompida não entram nos totais aprovados. Os 140 arquivos históricos conferidos por SHA-256 permaneceram inalterados.

O relatório consolidado final (`relatorio-consolidado-final.md`), os resultados estruturados (`consolidated-all-campaigns.json`) e o manifesto `SHA256SUMS.json` ficam no armazenamento privado da campanha. Não acompanham o Git. Os resultados cobrem somente os perfis locais ensaiados, em hardware compartilhado e com base sintética; não comprovam capacidade institucional, saturação máxima ou comportamento prolongado em produção.

`k6-summary.json` contém médias, percentis, RPS, erros, conexões/TLS e contadores. `resources.jsonl` reúne CPU, memória privada e working set por processo, uso global de CPU/memória e estatísticas do PostgreSQL. A coleta é periódica (intervalo pretendido de 2 s mais o custo de coleta); o timestamp registra a cadência real. CPU é apresentada em relação a um núcleo e à máquina. As estatísticas de banco incluem deltas entre as amostras; contadores globais também incluem o pequeno trabalho do monitor. O PostgreSQL atualiza esses contadores de forma assíncrona: a conferência de integridade usa contagens SQL diretas, não esses deltas. Não são gravados textos de consultas ou parâmetros.

A execução é interrompida se a memória disponível cair abaixo de 1 GiB ou se a CPU global ficar acima de 95% por mais de 30 s. Uma falha da coleta também interrompe o gerador. Esses limites protegem o computador e não são SLAs de produção. Gerador saturado torna a medição inconclusiva. Os arquivos preservam os dados coletados para diagnóstico.

Após aguardar transações, o verificador compara submissões, respostas e elegibilidades concluídas, procura duplicidades e órfãos, verifica as 21 chaves estrangeiras e valida médias/distribuições. Checagens HTTPS separadas da medição verificam repetição de um envio, perfis sem acesso, resultados abertos/insuficientes, pergunta opcional protegida e comentários não divulgados. Os relatórios não contêm tokens, senhas, corpos de resposta nem ligação aluno→submissão. As verificações cobrem ausência de vínculo direto e de divulgação indevida; não são um estudo de reidentificação temporal.

## Encerramento e testes dos scripts

```powershell
node --test tests/load/test/*.test.mjs
node --use-system-ca tests/load/stop.mjs $workspace
```

O encerramento confere novamente a identidade e para somente a API e o cluster de teste. Não remove dados nem backups. Preserve os relatórios agregados; credenciais fictícias e diretório de dados continuam privados e fora do Git. Não publique o workspace ou os logs brutos. Nenhum resultado local deve ser apresentado como capacidade comprovada de uma infraestrutura institucional.
