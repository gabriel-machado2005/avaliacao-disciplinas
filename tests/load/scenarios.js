import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Counter, Rate, Trend } from 'k6/metrics';
import { API, LIMITS, executors, payload, studentIndex, arrivalStages } from './plan.mjs';
import { ARRIVAL_EVENT_PREFIX, arrivalThresholds } from './arrival-accounting.mjs';

if (!__ENV.LOAD_MANIFEST || !__ENV.LOAD_SUMMARY || __ENV.K6_INSECURE_SKIP_TLS_VERIFY === 'true') {
  throw new Error('Use o executor local documentado; TLS não pode ser ignorado.');
}
const data = new SharedArray('cohort', () => [JSON.parse(open(__ENV.LOAD_MANIFEST))])[0];
const policy = __ENV.LOAD_DNS_POLICY || 'preferIPv6';
if (!['onlyIPv4', 'onlyIPv6', 'preferIPv6'].includes(policy)) throw new Error('Política DNS inválida.');
if (data.kind !== 'UNIXS_LOAD_MANIFEST_V1' || data.api !== API || data.students.length !== data.plan.accounts) {
  throw new Error('Manifesto de carga inválido.');
}
const unexpected = new Rate('unexpected_errors');
const accepted = new Counter('submissions_accepted');
const completed = new Counter('journeys_completed');
const started = new Counter('journeys_started');
const rejectedDuplicates = new Counter('duplicate_rejections');
const timing = {}, counts = {};
for (const op of Object.keys(LIMITS)) { timing[op] = new Trend(op + '_latency', true); counts[op] = new Counter(op + '_requests'); }
const usedOperations = data.scenario === 2 ? ['login'] : data.scenario === 3 ? ['login', 'list', 'questionnaire']
  : data.scenario === 6 ? ['login', 'submit'] : data.scenario === 5 ? Object.keys(LIMITS) : ['login', 'list', 'questionnaire', 'submit'];
const thresholds = { unexpected_errors: ['rate<0.01'], http_req_failed: ['rate<0.01'], checks: ['rate==1'], ...arrivalThresholds(data.scenario) };
for (const op of usedOperations) {
  const [avg, p95, p99] = LIMITS[op];
  const scope = data.scenario === 4 ? '{phase:nominal}' : data.scenario === 7 ? '{phase:recovery}' : '';
  thresholds[op + '_latency' + scope] = [`avg<=${avg}`, `p(95)<=${p95}`, `p(99)<=${p99}`];
}
if ([2, 4, 5, 7].includes(data.scenario)) thresholds.dropped_iterations = ['count==0'];
if (data.scenario === 1) { thresholds.journeys_completed = ['count==10']; thresholds.submissions_accepted = ['count==10']; }
if (data.scenario === 6) { thresholds.submissions_accepted = ['count==100']; thresholds.duplicate_rejections = ['count==400']; }
export const options = {
  scenarios: executors(data.scenario), thresholds, insecureSkipTLSVerify: false,
  dns: { policy, select: 'first', ttl: 'inf' },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
  systemTags: ['status', 'method', 'name', 'group', 'scenario', 'expected_response', 'tls_version'],
  batchPerHost: 5,
};

function record(op, response, valid) {
  const elapsed = Date.now() - exec.scenario.startTime;
  const phase = data.scenario === 7 ? elapsed >= 90000 ? 'recovery' : 'peak' : exec.scenario.name === 'nominal' ? 'nominal' : 'measured';
  timing[op].add(response.timings.duration, { phase }); counts[op].add(1);
  unexpected.add(!valid); check(valid, { [op + ' response valid']: value => value });
  return valid;
}
function send(op, method, route, body, token, expected = 200) {
  if (!route.startsWith('/') || route.startsWith('//')) exec.test.abort('Destino inválido');
  const response = http.request(method, API + route, body ? JSON.stringify(body) : null, {
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    tags: { name: op }, timeout: '10s', redirects: 0, responseCallback: http.expectedStatuses(expected),
  });
  record(op, response, response.status === expected);
  return response;
}
function student() {
  started.add(1);
  if (arrivalStages(data.scenario).length) console.log(ARRIVAL_EVENT_PREFIX + JSON.stringify({
    stage: exec.scenario.name, iteration: exec.scenario.iterationInTest, elapsedMs: Date.now() - exec.scenario.startTime,
  }));
  let index;
  try { index = studentIndex(data.scenario, exec.scenario.name, exec.scenario.iterationInTest); }
  catch { exec.test.abort('Partição esgotada ou inválida; nenhuma conta de outro patamar será usada.'); }
  if (index >= data.students.length - data.plan.readers) exec.test.abort('Dados esgotados; elegibilidade não será reutilizada.');
  return data.students[index];
}
function authenticate(account) {
  const response = send('login', 'POST', '/auth/login', { email: account.email, password: account.password }, null, 201);
  const token = response.status === 201 ? response.json('accessToken') : null;
  if (!token) { check(false, { 'login produced token': value => value }); return null; }
  return token;
}
export function loginOnly() { if (authenticate(student())) completed.add(1); }
export function journey() {
  const account = student(), token = authenticate(account); if (!token) return;
  const list = send('list', 'GET', '/evaluations/my', null, token);
  if (list.status !== 200) return;
  check(list.json(), { 'eligible evaluation listed': rows => Array.isArray(rows) && rows.some(row => row.evaluation.id === account.evaluationId && !row.completed) });
  const question = send('questionnaire', 'GET', '/evaluations/' + account.evaluationId + '/questionnaire', null, token);
  if (question.status !== 200) return;
  sleep(1);
  const response = send('submit', 'POST', '/evaluations/' + account.evaluationId + '/submissions', payload(data.questions), token, 201);
  if (response.status === 201) {
    check(response.json(), { 'complete submission acknowledged': body => body.answersCount === data.questions.length && Boolean(body.submissionId) });
    accepted.add(1); completed.add(1);
  }
}
let readerToken, managerToken;
export function readOnly() {
  const offset = data.students.length - data.plan.readers;
  const account = data.students[offset + (exec.vu.idInTest - 1) % data.plan.readers];
  if (!readerToken) readerToken = authenticate(account); if (!readerToken) return;
  send('list', 'GET', '/evaluations/my', null, readerToken);
  send('questionnaire', 'GET', '/evaluations/' + account.evaluationId + '/questionnaire', null, readerToken);
  sleep(2);
}
export function resultsOnly() {
  if (!managerToken) managerToken = authenticate(data.managers[(exec.vu.idInTest - 1) % data.managers.length]);
  if (!managerToken) return;
  send('results', 'GET', '/evaluations/' + data.resultId + '/results', null, managerToken);
  send('analysis', 'GET', '/evaluations/analysis' + data.comparisonQuery, null, managerToken);
  sleep(5);
}
export function duplicates() {
  const account = student(), token = authenticate(account); if (!token) return;
  const requests = Array.from({ length: 5 }, () => ({ method: 'POST', url: API + '/evaluations/' + account.evaluationId + '/submissions',
    body: JSON.stringify(payload(data.questions)), params: { headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      timeout: '10s', redirects: 0, tags: { name: 'submit' }, responseCallback: http.expectedStatuses(201, 400) } }));
  const responses = http.batch(requests);
  let successes = 0, duplicatesCount = 0;
  for (const response of responses) {
    const duplicate = response.status === 400 && response.json('message') === 'Esta avaliação já foi respondida.';
    record('submit', response, response.status === 201 || duplicate);
    if (response.status === 201) { successes++; accepted.add(1); }
    if (duplicate) { duplicatesCount++; rejectedDuplicates.add(1); }
  }
  check(successes === 1 && duplicatesCount === 4, { 'exactly one concurrent submission accepted': value => value });
  completed.add(1);
}
export function handleSummary(summary) {
  return { [__ENV.LOAD_SUMMARY]: JSON.stringify(summary, null, 2) + '\n' };
}
