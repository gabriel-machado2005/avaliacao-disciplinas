import assert from "node:assert/strict";
import { test } from "node:test";
import { getEvaluationPeriodStatus } from "../src/evaluation-period-status.ts";

const period = {
  active: true,
  startDate: "2026-11-19T09:00:00-03:00",
  endDate: "2026-11-19T18:00:00-03:00",
};

test("indica que o período ativo ainda não iniciou antes da abertura", () => {
  assert.deepEqual(
    getEvaluationPeriodStatus(period, Date.parse(period.startDate) - 1),
    { label: "Ainda não iniciada", style: "pending" },
  );
});

test("indica período em andamento no instante da abertura", () => {
  assert.deepEqual(
    getEvaluationPeriodStatus(period, Date.parse(period.startDate)),
    { label: "Em andamento", style: "active" },
  );
});

test("interpreta o fuso horário ao identificar um período em andamento", () => {
  assert.deepEqual(
    getEvaluationPeriodStatus(period, Date.parse("2026-11-19T15:00:00Z")),
    { label: "Em andamento", style: "active" },
  );
});

test("mantém o período em andamento no instante exato do encerramento", () => {
  assert.deepEqual(
    getEvaluationPeriodStatus(period, Date.parse(period.endDate)),
    { label: "Em andamento", style: "active" },
  );
});

test("indica período encerrado após o prazo", () => {
  assert.deepEqual(
    getEvaluationPeriodStatus(period, Date.parse(period.endDate) + 1),
    { label: "Encerrada", style: "inactive" },
  );
});

test("prioriza a inativação antes, durante e depois do período", () => {
  for (const instant of [
    Date.parse(period.startDate) - 1,
    Date.parse(period.startDate),
    Date.parse(period.endDate) + 1,
  ]) {
    assert.deepEqual(
      getEvaluationPeriodStatus({ ...period, active: false }, instant),
      { label: "Inativa", style: "inactive" },
    );
  }
});
