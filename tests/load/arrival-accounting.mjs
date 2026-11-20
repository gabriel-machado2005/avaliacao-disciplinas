// Compartilhado entre o k6 e o verificador Node; não realiza I/O.
import { arrivalStages, studentIndex, ARRIVAL_BOUNDARY_EXTRA } from './plan.mjs';

export const ARRIVAL_EVENT_PREFIX = 'LOAD_ARRIVAL ';

export function expectedSubmissionsMatch(scenario, accepted, journeys, arrivals) {
  if (!Number.isSafeInteger(accepted) || accepted < 0) return false;
  if ([4, 5].includes(scenario)) return Boolean(arrivals?.applicable && arrivals.passed && accepted === arrivals.totalCompleted);
  if ([1, 6].includes(scenario)) return accepted === journeys;
  if (scenario === 2) return Boolean(accepted === 0 && arrivals?.applicable && arrivals.passed);
  if (scenario === 3) return accepted === 0;
  if (scenario === 7) return accepted >= 1273 && accepted <= 1276;
  return false;
}

export function arrivalThresholds(number) {
  const thresholds = {}, extra = ARRIVAL_BOUNDARY_EXTRA[number] || 0;
  for (const stage of arrivalStages(number)) {
    const tag = `{scenario:${stage.name}}`, range = [`count>=${stage.expected}`, `count<=${stage.expected + extra}`];
    for (const metric of ['journeys_started', 'journeys_completed', 'iterations', 'login_requests']) thresholds[metric + tag] = range;
    thresholds['http_reqs' + tag] = [`count>=${stage.expected * (number === 2 ? 1 : 4)}`, `count<=${(stage.expected + extra) * (number === 2 ? 1 : 4)}`];
    thresholds['dropped_iterations' + tag] = ['count==0'];
    // Exporta percentis por patamar; os limites de latência já existentes continuam globais.
    thresholds['login_latency' + tag] = ['max>=0'];
  }
  return thresholds;
}

export function parseArrivalEvents(text) {
  const events = []; let malformed = 0;
  for (const line of text.split(/\r?\n/)) {
    if (!line.includes(ARRIVAL_EVENT_PREFIX)) continue;
    try {
      const record = JSON.parse(line);
      if (typeof record.msg !== 'string' || !record.msg.startsWith(ARRIVAL_EVENT_PREFIX)) throw new Error('event');
      const event = JSON.parse(record.msg.slice(ARRIVAL_EVENT_PREFIX.length));
      if (Object.keys(event).sort().join(',') !== 'elapsedMs,iteration,stage') throw new Error('fields');
      events.push(event);
    } catch { malformed++; }
  }
  return { events, malformed };
}

export function reconcileArrivals(number, summary, trace) {
  const stages = arrivalStages(number), issues = [], usedSlots = new Set();
  if (!stages.length) return { applicable: false, passed: true, stages: [], issues };
  const extra = ARRIVAL_BOUNDARY_EXTRA[number] || 0;
  const read = name => {
    const value = summary.metrics[name]?.values.count;
    if (!Number.isSafeInteger(value) || value < 0) { issues.push('MISSING_OR_INVALID_' + name); return null; }
    return value;
  };
  if (trace.malformed) issues.push('MALFORMED_ARRIVAL_EVENTS');
  if (trace.events.some(event => !stages.some(stage => stage.name === event.stage))) issues.push('UNKNOWN_STAGE_EVENT');
  const rows = stages.map(stage => {
    const tag = `{scenario:${stage.name}}`;
    const started = read('journeys_started' + tag), completed = read('journeys_completed' + tag);
    const iterations = read('iterations' + tag), logins = read('login_requests' + tag);
    const requests = read('http_reqs' + tag), dropped = read('dropped_iterations' + tag);
    const events = trace.events.filter(event => event.stage === stage.name);
    const indices = new Set();
    for (const event of events) {
      if (!Number.isFinite(event.elapsedMs) || event.elapsedMs < 0 || indices.has(event.iteration)) issues.push('INVALID_OR_DUPLICATE_EVENT_' + stage.name);
      indices.add(event.iteration);
      try {
        const slot = studentIndex(number, stage.name, event.iteration);
        if (usedSlots.has(slot)) issues.push('REUSED_ACCOUNT_SLOT_' + stage.name);
        usedSlots.add(slot);
      } catch { issues.push('PARTITION_OVERFLOW_' + stage.name); }
    }
    if (started < stage.expected || started > stage.expected + extra) issues.push('COUNT_OUT_OF_RANGE_' + stage.name);
    if (started !== completed || started !== iterations || started !== logins || requests !== started * (number === 2 ? 1 : 4) || dropped !== 0) issues.push('COUNTERS_NOT_RECONCILED_' + stage.name);
    if (events.length !== started || [...indices].some(i => !Number.isSafeInteger(i) || i < 0 || i >= started)) issues.push('EVENTS_NOT_RECONCILED_' + stage.name);
    return { ...stage, maximumAccepted: stage.expected + extra, started, completed, iterations, logins, requests, dropped,
      recordedEvents: events.length, boundaryOrLateStarts: events.filter(event => event.elapsedMs >= stage.durationSeconds * 1000).length,
      firstStartMs: events.length ? Math.min(...events.map(event => event.elapsedMs)) : null,
      lastStartMs: events.length ? Math.max(...events.map(event => event.elapsedMs)) : null,
      loginLatencyMs: summary.metrics['login_latency' + tag]?.values || null };
  });
  const totalStarted = rows.reduce((sum, row) => sum + (row.started || 0), 0);
  const totalCompleted = rows.reduce((sum, row) => sum + (row.completed || 0), 0);
  if (read('journeys_started') !== totalStarted || read('journeys_completed') !== totalCompleted) issues.push('TOTAL_COUNTERS_NOT_RECONCILED');
  if (number !== 5 && (read('http_reqs') !== rows.reduce((sum, row) => sum + (row.requests || 0), 0) || read('iterations') !== totalCompleted)) issues.push('NATIVE_TOTALS_NOT_RECONCILED');
  return { applicable: true, passed: issues.length === 0, boundaryExtraPerStage: extra, stages: rows,
    totalStarted, totalCompleted, uniqueAccountSlots: usedSlots.size, issues };
}
