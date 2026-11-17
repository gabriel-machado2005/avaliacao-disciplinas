import assert from "node:assert/strict";
import { test } from "node:test";
import { buildEvaluationResultsCsv } from "../src/evaluation-results-csv.ts";

function serialize(questions) {
  return buildEvaluationResultsCsv({
    evaluation: {
      discipline: { name: "Programação", code: "PROG" },
      classGroup: "A01",
      academicTerm: "2026/2",
    },
    participation: { eligible: 10, responses: 5, rate: 50 },
    dimensions: [{ id: "dim", name: "Organização", questions }],
  });
}

test("protege as métricas e diferencia perguntas sem respostas no CSV", () => {
  const restricted = {
    responses: 91,
    average: 92,
    distribution: { "Rótulo restrito": 93 },
    comments: ["Texto privado"],
  };
  const csv = serialize([
    {
      id: "baixo",
      text: "Escala com poucas respostas",
      type: "SCALE",
      status: "PROTECTED",
      ...restricted,
    },
    {
      id: "vazia",
      text: "Pergunta opcional sem respostas",
      type: "SINGLE_CHOICE",
      status: "NO_RESPONSES",
      ...restricted,
    },
    {
      id: "comentario",
      text: "Comentário com poucas respostas",
      type: "TEXT",
      status: "PROTECTED",
      ...restricted,
    },
  ]);
  const [header, scale, empty, text] = csv.split("\r\n");

  assert.ok(header.startsWith("\uFEFF"));
  assert.ok(header.endsWith('"Situação da divulgação"'));
  assert.ok(
    scale.endsWith(
      '"Escala com poucas respostas";"SCALE";"";"";"";"Resultados protegidos"',
    ),
  );
  assert.ok(
    empty.endsWith(
      '"Pergunta opcional sem respostas";"SINGLE_CHOICE";"";"";"";"Sem respostas"',
    ),
  );
  assert.ok(
    text.endsWith(
      '"Comentário com poucas respostas";"TEXT";"";"";"";"Resultados protegidos"',
    ),
  );
  assert.doesNotMatch(csv, /91|92|93|Rótulo restrito|Texto privado/);
});

test("exporta somente a contagem divulgável de uma pergunta discursiva", () => {
  const csv = serialize([
    {
      id: "discursiva",
      text: "Deixe um comentário",
      type: "TEXT",
      status: "COMMENTS_PROTECTED",
      responses: 3,
      comments: ["Nome identificado em texto livre"],
      average: 71,
      distribution: { "Métrica indevida": 72 },
    },
  ]);

  assert.ok(
    csv.endsWith(
      '"Deixe um comentário";"TEXT";"3";"";"";"Comentários protegidos"',
    ),
  );
  assert.doesNotMatch(csv, /Nome identificado|71|72|Métrica indevida/);
});

test("mantém as métricas divulgadas e o escape de células", () => {
  const [, scale, choice] = serialize([
    {
      id: "escala",
      text: '=Pergunta "escala"',
      type: "SCALE",
      status: "AVAILABLE",
      responses: 3,
      average: 3.67,
      distribution: { 2: 1, 4: 1, 5: 1 },
    },
    {
      id: "escolha",
      text: "Pergunta de escolha",
      type: "SINGLE_CHOICE",
      status: "AVAILABLE",
      responses: 3,
      distribution: { "Boa; ótima": 2, Regular: 1 },
    },
  ]).split("\r\n");

  assert.ok(
    scale.endsWith(
      "\"'" +
        '=Pergunta ""escala""";"SCALE";"3";"3,67";"2: 1 | 4: 1 | 5: 1";"Divulgado"',
    ),
  );
  assert.ok(
    choice.endsWith(
      '"Pergunta de escolha";"SINGLE_CHOICE";"3";"";"Boa; ótima: 2 | Regular: 1";"Divulgado"',
    ),
  );
});
