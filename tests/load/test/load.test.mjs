import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import { afterEach, mock, test } from 'node:test';
import { allocation, budget, executors, payload, API, arrivalStages, studentIndex } from '../plan.mjs';
import { workspacePath, PRIVATE_ROOT, validateState, identity, api, dnsPolicy } from '../environment.mjs';

afterEach(() => mock.restoreAll());
const dir = path.join(PRIVATE_ROOT, 'carga_20990101T000000Z_deadbeef');
function state() { return { kind: 'UNIXS_LOAD_V1', api: API, workspace: dir,
  dataDirectory: path.join(dir, 'pgdata'), db: { host: '127.0.0.1', port: 55487, name: 'unixs_load_test', user: 'unixs_load_test', password: 'somente-ficticio' }, jwtSecret: 'somente-ficticio' }; }

test('orçamento inclui reservas e partições distintas por repetição', () => {
  assert.equal(budget.reduce((sum, row) => sum + row.accounts, 0), 7000);
  assert.equal(budget.reduce((sum, row) => sum + row.accountsAllRepetitions, 0), 21000);
  const cohorts = new Set();
  for (let scenario = 1; scenario <= 7; scenario++) for (let repetition = 1; repetition <= 3; repetition++) {
    const p = allocation(scenario, repetition); assert.ok(p.accounts - p.readers >= p.journeys);
    cohorts.add(p.cohort);
  }
  assert.equal(cohorts.size, 21);
});

test('patamares de envio usam intervalos de contas sem sobreposição', () => {
  const ranges = arrivalStages(4).map(s => [s.offset, s.capacity]);
  const used = new Set();
  for (const [offset, count] of ranges) for (let i = offset; i < offset + count; i++) { assert.ok(!used.has(i)); used.add(i); }
  assert.equal(used.size, 2952); assert.equal(Math.max(...used), 2951);
  for (const stage of arrivalStages(4)) assert.ok(studentIndex(4, stage.name, stage.expected) < stage.offset + stage.capacity);
});

test('somente o smoke inicia um VU e exatamente dez jornadas', () => {
  assert.deepEqual(executors(1).smoke, { executor: 'shared-iterations', vus: 1, iterations: 10, maxDuration: '2m', exec: 'journey' });
  assert.equal(allocation(1, 1).accounts, 10);
});

for (const [scenario, repetition] of [[0, 1], [8, 1], [1, 0], [1, 4]]) {
  test(`recusa cenário/repetição não autorizável: ${scenario}/${repetition}`, () => assert.throws(() => allocation(scenario, repetition)));
}

test('separa leitores das elegibilidades consumíveis na carga mista', () => {
  const p = allocation(5, 1);
  assert.equal(p.readers, 5); assert.equal(p.accounts - p.readers, 1800); assert.equal(p.journeys, 1500);
});

test('rejeita diretórios do projeto e de bancos não pertencentes ao ensaio', () => {
  for (const candidate of [process.cwd(), 'C:/Program Files/PostgreSQL/18/data', path.join(PRIVATE_ROOT, 'validacao_anterior'), path.join(PRIVATE_ROOT, '../pgdata')]) {
    assert.throws(() => workspacePath(candidate), /LOAD_WORKSPACE/);
  }
  assert.equal(workspacePath(dir), dir);
});

for (const [field, value] of [['port', 5432], ['name', 'avaliacao_disciplinas'], ['user', 'postgres'], ['host', 'localhost']]) {
  test(`bloqueia configuração fora da instância isolada: ${field}`, () => {
    const candidate = state(); candidate.db[field] = value;
    assert.throws(() => validateState(candidate, dir), /LOAD_CONFIG/);
  });
}

test('valida identidade recebida do servidor antes de aceitar o ambiente', async () => {
  mock.method(fs, 'realpathSync', value => path.resolve(value));
  const actual = { database: 'unixs_load_test', port: 55487, address: '127.0.0.1', username: 'unixs_load_test', directory: path.join(dir, 'pgdata') };
  const client = { query: async () => ({ rows: [actual] }) };
  assert.equal((await identity(client, state())).database, 'unixs_load_test');
  actual.directory = 'C:/Program Files/PostgreSQL/18/data';
  await assert.rejects(() => identity(client, state()));
});

test('recusa destino HTTP ou porta da aplicação principal sem fazer requisição', () => {
  assert.throws(() => api({ api: 'http://localhost:3001' }, '/'), /LOAD_URL/);
  assert.throws(() => api({ api: 'https://localhost:3000' }, '/'), /LOAD_URL/);
  assert.throws(() => api({ api: API }, '//outro-destino'), /LOAD_URL/);
});

test('payload respeita tipos e não adiciona identificador de estudante', () => {
  const body = payload([{ id: 'a', type: 'SCALE', required: true }, { id: 'b', type: 'SINGLE_CHOICE', required: true }, { id: 'c', type: 'TEXT', required: false }]);
  assert.equal(body.answers.length, 3); assert.equal(body.answers[0].scaleValue, 3);
  assert.ok(!JSON.stringify(body).includes('student')); assert.equal(payload([{ id: 'x', type: 'TEXT', required: false }], false).answers.length, 0);
});

test('seleciona a família de loopback sem alterar hostname ou validação TLS', () => {
  assert.equal(dnsPolicy('::1'), 'onlyIPv6'); assert.equal(dnsPolicy('127.0.0.1'), 'onlyIPv4');
});

test('não aceita endereço externo ou wildcard para o gerador', () => {
  for (const address of ['0.0.0.0', '::', '192.168.0.1']) assert.throws(() => dnsPolicy(address), /LOAD_NON_LOOPBACK/);
});
