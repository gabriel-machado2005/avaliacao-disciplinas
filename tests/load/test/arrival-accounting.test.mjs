import assert from 'node:assert/strict';
import { test } from 'node:test';
import { allocation, arrivalStages, studentIndex, executors } from '../plan.mjs';
import { arrivalThresholds, parseArrivalEvents, reconcileArrivals, ARRIVAL_EVENT_PREFIX, expectedSubmissionsMatch } from '../arrival-accounting.mjs';

function fixture(counts = [60, 120, 300], number = 2) {
  const summary = { metrics: {} }, trace = { events: [], malformed: 0 };
  const set = (name, count) => summary.metrics[name] = { values: { count } };
  let total = 0;
  arrivalStages(number).forEach((stage, i) => {
    const count = counts[i], tag = `{scenario:${stage.name}}`; total += count;
    for (const metric of ['journeys_started', 'journeys_completed', 'iterations', 'login_requests']) set(metric + tag, count);
    set('http_reqs' + tag, count * (number === 2 ? 1 : 4)); set('dropped_iterations' + tag, 0);
    for (let iteration = 0; iteration < count; iteration++) trace.events.push({ stage: stage.name, iteration, elapsedMs: iteration * 1000 / stage.rate });
  });
  for (const metric of ['journeys_started', 'journeys_completed', 'iterations']) set(metric, total);
  set('http_reqs', total * (number === 2 ? 1 : 4));
  return { summary, trace };
}
const verify = ({ summary, trace }, number = 2) => reconcileArrivals(number, summary, trace);

test('preserva três patamares de 60 s, taxas e inícios, sem cortes de duração ou gracefulStop', () => {
  const stages = Object.values(executors(2));
  assert.deepEqual(stages.map(s => s.rate), [1, 2, 5]);
  assert.deepEqual(stages.map(s => s.duration), ['60s', '60s', '60s']);
  assert.deepEqual(stages.map(s => s.startTime), ['0s', '60s', '120s']);
  assert.ok(stages.every(s => s.executor === 'constant-arrival-rate' && s.gracefulStop === '30s'));
});

test('reserva 20% separadamente: uma chegada na fronteira não invade o próximo patamar', () => {
  for (const number of [2, 4, 5]) {
    const stages = arrivalStages(number), slots = new Set();
    for (const stage of stages) for (let i = 0; i < stage.capacity; i++) {
      const slot = studentIndex(number, stage.name, i); assert.ok(!slots.has(slot)); slots.add(slot);
    }
    assert.equal(slots.size, number === 2 ? 576 : number === 4 ? 2952 : 1800);
    for (const stage of stages) assert.throws(() => studentIndex(number, stage.name, stage.capacity), /PARTITION_EXHAUSTED/);
  }
  assert.equal(studentIndex(2, 'login1', 60), 60);
  assert.equal(studentIndex(2, 'login2', 0), 72);
  assert.equal(studentIndex(2, 'login5', 0), 216);
});

test('recusa índices fracionários, negativos, cenário incorreto e esgotamento antes de escolher outra conta', () => {
  for (const i of [-1, 1.5, NaN]) assert.throws(() => studentIndex(2, 'login1', i));
  assert.throws(() => studentIndex(2, 'outra', 0));
  assert.throws(() => studentIndex(7, 'spike', 1532));
});

test('série independente preserva o nome da execução histórica e mantém três repetições', () => {
  assert.equal(allocation(2, 1).cohort, 's2_r1');
  const cohorts = [1, 2, 3].map(r => allocation(2, r, 'login_v2').cohort);
  assert.equal(new Set(cohorts).size, 3); assert.ok(!cohorts.includes('s2_r1'));
  for (const bad of ['../old', 'a/b', 'A', 'a'.repeat(25)]) assert.throws(() => allocation(2, 1, bad));
  assert.throws(() => allocation(2, 4, 'login_v2'));
});

test('concilia 480 jornadas exatas com todos os eventos e contadores nativos', () => {
  const r = verify(fixture()); assert.equal(r.passed, true); assert.equal(r.totalStarted, 480); assert.equal(r.uniqueAccountSlots, 480);
});

test('concilia 483 sem descartar fronteiras: 61, 121 e 301, com três eventos em 60 s', () => {
  const r = verify(fixture([61, 121, 301])); assert.equal(r.passed, true);
  assert.equal(r.totalStarted, 483); assert.equal(r.uniqueAccountSlots, 483);
  assert.deepEqual(r.stages.map(s => s.boundaryOrLateStarts), [1, 1, 1]);
  assert.deepEqual(r.stages.map(s => s.recordedEvents), [61, 121, 301]);
});

for (const counts of [[59, 121, 301], [62, 120, 301], [61, 122, 300], [60, 120, 302]]) {
  test(`reprova distribuição inválida ${counts}, mesmo se o total parece aceitável`, () => assert.equal(verify(fixture(counts)).passed, false));
}

test('não permite ocultar três requisições excedentes no contador total', () => {
  const f = fixture(); f.summary.metrics.http_reqs.values.count = 483;
  assert.ok(verify(f).issues.includes('NATIVE_TOTALS_NOT_RECONCILED'));
});

test('não aprova contagens ausentes, chegada descartada ou login não concluído', () => {
  const missing = fixture(); delete missing.summary.metrics['iterations{scenario:login1}']; assert.equal(verify(missing).passed, false);
  const dropped = fixture(); dropped.summary.metrics['dropped_iterations{scenario:login1}'].values.count = 1; assert.equal(verify(dropped).passed, false);
  const failed = fixture(); failed.summary.metrics['journeys_completed{scenario:login1}'].values.count--; assert.equal(verify(failed).passed, false);
});

test('reprova eventos ausentes, duplicados, inválidos ou de cenário desconhecido', () => {
  const missing = fixture(); missing.trace.events.pop(); assert.equal(verify(missing).passed, false);
  const duplicate = fixture(); duplicate.trace.events[1] = duplicate.trace.events[0]; assert.equal(verify(duplicate).passed, false);
  const bad = fixture(); bad.trace.events[0].elapsedMs = -1; assert.equal(verify(bad).passed, false);
  const unknown = fixture(); unknown.trace.events.push({stage:'unknown',iteration:0,elapsedMs:0}); assert.equal(verify(unknown).passed, false);
});

test('parser conserva os eventos e recusa campos de identidade ou eventos malformados', () => {
  const event = {stage:'login1',iteration:60,elapsedMs:60001};
  const line = msg => JSON.stringify({level:'info',source:'console',msg:ARRIVAL_EVENT_PREFIX + JSON.stringify(msg)});
  const r = parseArrivalEvents(line(event) + '\n' + line({...event,email:'nao-publicar'}) + '\nLOAD_ARRIVAL quebrado');
  assert.deepEqual(r.events, [event]); assert.equal(r.malformed, 2);
});

test('aceita somente uma chegada adicional em cada patamar dos cenários 4 e 5', () => {
  assert.equal(verify(fixture([120, 240, 600, 1500], 4), 4).passed, true);
  const upper = verify(fixture([121, 241, 601, 1501], 4), 4);
  assert.equal(upper.passed, true); assert.equal(upper.totalCompleted, 2464);
  assert.equal(verify(fixture([122, 240, 600, 1500], 4), 4).passed, false);
  assert.equal(verify(fixture([119, 241, 601, 1501], 4), 4).passed, false);
  assert.equal(verify(fixture([1501], 5), 5).passed, true);
  assert.equal(verify(fixture([1502], 5), 5).passed, false);
  assert.equal(verify(fixture([1499], 5), 5).passed, false);
  assert.equal(reconcileArrivals(7, {metrics:{}}, {events:[],malformed:0}).applicable, false);
});

test('concilia submissões com todas as jornadas concluídas, incluindo chegadas de fronteira', () => {
  const arrivals = verify(fixture([121, 241, 601, 1501], 4), 4);
  assert.equal(expectedSubmissionsMatch(4, 2464, 2460, arrivals), true);
  assert.equal(expectedSubmissionsMatch(4, 2460, 2460, arrivals), false);
  assert.equal(expectedSubmissionsMatch(4, 2465, 2460, arrivals), false);
  assert.equal(expectedSubmissionsMatch(4, 2464, 2460, {...arrivals,passed:false}), false);
  const mixed = verify(fixture([1501], 5), 5);
  assert.equal(expectedSubmissionsMatch(5, 1501, 1500, mixed), true);
  assert.equal(expectedSubmissionsMatch(5, 1500, 1500, mixed), false);
});

test('preserva contagens exatas nos cenários de quantidade fixa e limites dos demais perfis', () => {
  for (const [s,n] of [[1,10],[6,100]]) {
    assert.equal(expectedSubmissionsMatch(s,n,n), true);
    assert.equal(expectedSubmissionsMatch(s,n+1,n), false);
  }
  assert.equal(expectedSubmissionsMatch(3,0,0),true); assert.equal(expectedSubmissionsMatch(3,1,0),false);
  assert.equal(expectedSubmissionsMatch(7,1273,1276),true); assert.equal(expectedSubmissionsMatch(7,1277,1276),false);
  assert.equal(expectedSubmissionsMatch(5,NaN,1500),false);
});

test('mantém taxas, durações e orçamentos de 4 e 5 sem tolerância temporal extra', () => {
  const four=Object.values(executors(4));
  assert.deepEqual(four.map(s=>s.rate),[1,2,5,5]);
  assert.deepEqual(four.map(s=>s.duration),['120s','120s','120s','300s']);
  assert.deepEqual(four.map(s=>s.startTime),['0s','120s','240s','360s']);
  assert.deepEqual(arrivalStages(4).map(s=>[s.expected,s.expected+1]),[[120,121],[240,241],[600,601],[1500,1501]]);
  const five=executors(5); assert.equal(five.students.rate,5);assert.equal(five.students.duration,'300s');
  assert.equal(five.readers.vus,5);assert.equal(five.managers.vus,2);
  assert.equal(allocation(4,1).accounts,2952);assert.equal(allocation(5,1).accounts,1805);
});

test('exporta contadores por patamar e não usa o agregado como substituto', () => {
  const t = arrivalThresholds(2);
  assert.deepEqual(t['journeys_started{scenario:login1}'], ['count>=60','count<=61']);
  assert.deepEqual(t['http_reqs{scenario:login5}'], ['count>=300','count<=301']);
  assert.deepEqual(t['dropped_iterations{scenario:login2}'], ['count==0']);
});
