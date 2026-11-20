// Sem dependências Node: este módulo também é importado pelo k6.
export const API = 'https://localhost:3001';
export const DATABASE = 'unixs_load_test';
export const DB_PORT = 55487;
export const COMMENT = 'TEXTO_FICTICIO_PROTEGIDO_TESTE_DE_CARGA';
export const REPEATS = 3;
// No máximo uma chegada de fronteira por patamar nos executores constantes.
export const ARRIVAL_BOUNDARY_EXTRA = { 2: 1, 4: 1, 5: 1 };
export const LIMITS = {
  login: [1000, 2000, 3000], list: [500, 1000, 2000],
  questionnaire: [500, 1000, 2000], submit: [1000, 2000, 4000],
  results: [1500, 3000, 5000], analysis: [1500, 3000, 5000],
};

export function plan(number) {
  const n = Number(number);
  const rows = {
    1: { name: 'smoke', journeys: 10, accounts: 10, readers: 0, duration: 120 },
    2: { name: 'login', journeys: 480, accounts: 576, readers: 0, duration: 180 },
    3: { name: 'readers', journeys: 0, accounts: 25, readers: 25, duration: 405 },
    4: { name: 'journeys', journeys: 2460, accounts: 2952, readers: 0, duration: 660 },
    5: { name: 'mixed', journeys: 1500, accounts: 1805, readers: 5, duration: 300 },
    6: { name: 'duplicates', journeys: 100, accounts: 100, readers: 0, duration: 300 },
    // Integral = 1275 chegadas; teto conservador por fase = 1276.
    7: { name: 'spike', journeys: 1276, accounts: 1532, readers: 0, duration: 120 },
  };
  if (!rows[n]) throw new Error('Cenário deve estar entre 1 e 7.');
  return { number: n, ...rows[n] };
}

export function allocation(number, repetition, series = '') {
  const p = plan(number);
  if (!Number.isInteger(repetition) || repetition < 1 || repetition > REPEATS) {
    throw new Error('Repetição deve estar entre 1 e 3.');
  }
  if (typeof series !== 'string' || series && !/^[a-z][a-z0-9_]{0,23}$/.test(series)) {
    throw new Error('Série inválida: use até 24 letras minúsculas, números ou sublinhados.');
  }
  return { ...p, repetition, series, cohort: `${series ? series + '_' : ''}s${p.number}_r${repetition}` };
}

export function arrivalStages(number) {
  const rows = {
    2: [['login1', 1, 60, 0], ['login2', 2, 60, 60], ['login5', 5, 60, 120]],
    4: [['first', 1, 120, 0], ['second', 2, 120, 120], ['third', 5, 120, 240], ['nominal', 5, 300, 360]],
    5: [['students', 5, 300, 0]],
  };
  let offset = 0;
  return (rows[Number(number)] || []).map(([name, rate, durationSeconds, startSeconds]) => {
    const expected = rate * durationSeconds, capacity = Math.ceil(expected * 1.2);
    const stage = { name, rate, durationSeconds, startSeconds, expected, capacity, offset };
    offset += capacity;
    return stage;
  });
}

export function studentIndex(number, scenario, iteration) {
  if (!Number.isSafeInteger(iteration) || iteration < 0) throw new Error('LOAD_INVALID_ITERATION');
  const stages = arrivalStages(number);
  const partition = stages.length ? stages.find(stage => stage.name === scenario)
    : { offset: 0, capacity: plan(number).accounts - plan(number).readers };
  if (!partition || iteration >= partition.capacity) throw new Error('LOAD_PARTITION_EXHAUSTED');
  return partition.offset + iteration;
}

export function executors(number) {
  const arrivals = () => Object.fromEntries(arrivalStages(number).map(stage => [stage.name, {
    executor: 'constant-arrival-rate', rate: stage.rate, timeUnit: '1s', duration: stage.durationSeconds + 's',
    startTime: stage.startSeconds + 's', preAllocatedVUs: 25, maxVUs: 100, gracefulStop: '30s',
    exec: Number(number) === 2 ? 'loginOnly' : 'journey',
    env: { DATA_OFFSET: String(stage.offset), DATA_CAPACITY: String(stage.capacity) },
  }]));
  switch (Number(number)) {
    case 1: return { smoke: { executor: 'shared-iterations', vus: 1, iterations: 10, maxDuration: '2m', exec: 'journey' } };
    case 2: return arrivals();
    case 3: return { readers: { executor: 'ramping-vus', startVUs: 0,
      stages: [5, 10, 25].flatMap(target => [{ target, duration: '15s' }, { target, duration: '120s' }]),
      gracefulRampDown: '30s', exec: 'readOnly' } };
    case 4: return arrivals();
    case 5: return { ...arrivals(),
      readers: { executor: 'constant-vus', vus: 5, duration: '300s', exec: 'readOnly' },
      managers: { executor: 'constant-vus', vus: 2, duration: '300s', exec: 'resultsOnly' } };
    case 6: return { duplicates: { executor: 'shared-iterations', vus: 10, iterations: 100, maxDuration: '5m', exec: 'duplicates' } };
    case 7: return { spike: { executor: 'ramping-arrival-rate', startRate: 5, timeUnit: '1s',
      stages: [{ target: 20, duration: '15s' }, { target: 20, duration: '30s' },
        { target: 5, duration: '15s' }, { target: 5, duration: '60s' }],
      preAllocatedVUs: 50, maxVUs: 100, gracefulStop: '30s', exec: 'journey' } };
    default: throw new Error('Cenário desconhecido.');
  }
}

export function payload(questions, optional = true) {
  return { answers: questions.filter(q => optional || q.required).map(q => ({
    questionId: q.id,
    ...(q.type === 'SCALE' ? { scaleValue: 3 } : q.type === 'SINGLE_CHOICE'
      ? { choiceValue: 'Bom' } : { textValue: COMMENT }),
  })) };
}

export const budget = Array.from({ length: 7 }, (_, index) => ({
  ...plan(index + 1), repetitions: REPEATS, accountsAllRepetitions: plan(index + 1).accounts * REPEATS,
}));
