import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import assert from 'node:assert/strict';
import { allocation } from './plan.mjs';
import { ROOT, DEFAULT_K6, readState, preflight, connect, save, cliError, dnsPolicy } from './environment.mjs';
import { seedCohort } from './fixtures.mjs';
import { verify } from './verify.mjs';
import { parseArrivalEvents, reconcileArrivals } from './arrival-accounting.mjs';

async function main() {
  const { values } = parseArgs({ options: { workspace: { type: 'string' }, scenario: { type: 'string', default: '1' },
    repetition: { type: 'string', default: '1' }, series: { type: 'string', default: '' }, k6: { type: 'string', default: DEFAULT_K6 }, 'allow-load': { type: 'boolean', default: false } } });
  const p = allocation(Number(values.scenario), Number(values.repetition), values.series);
  if (p.number !== 1 && !values['allow-load']) throw new Error('LOAD_HIGHER_SCENARIOS_REQUIRE_EXPLICIT_ALLOW_LOAD');
  const state = readState(values.workspace);
  const actualIdentity = await preflight(state);
  const { manifest, dir } = await seedCohort(state, p.number, p.repetition, p.series);
  save(path.join(dir, 'identity-before-run.json'), actualIdentity);
  // Marcador anterior ao início: uma repetição consumida não pode ser executada outra vez.
  save(path.join(dir, 'consumed.json'), { startedAt: new Date().toISOString(), cohort: p.cohort });
  const monitor = await connect(state);
  let lastCpu = new Map(), lastTime, generator, highCpuSince, resourceAbort, sampleFailure;
  const samples = [];
  async function sample() {
    const activity = (await monitor.query("SELECT pid,state,wait_event_type,pg_blocking_pids(pid) AS blockers FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1", ['unixs_load_' + state.id])).rows;
    const stats = (await monitor.query('SELECT numbackends,xact_commit,xact_rollback,blks_read,blks_hit,temp_files,temp_bytes,deadlocks,tup_inserted,tup_updated,tup_deleted FROM pg_stat_database WHERE datname=current_database()')).rows[0];
    const roles = [{ role: 'api', pids: [state.apiPid] }, { role: 'postgres', pids: [state.pgPid, ...activity.map(row => row.pid)] }, { role: 'generator', pids: generator ? [generator.pid] : [] }];
    const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(ROOT, 'tests/load/resources.ps1'), '-RoleMap', JSON.stringify(roles)], { encoding: 'utf8', windowsHide: true, timeout: 20000 });
    if (result.status !== 0) throw new Error('LOAD_RESOURCE_COLLECTION_FAILED');
    const system = JSON.parse(result.stdout), now = Date.now(), elapsed = lastTime ? (now - lastTime) / 1000 : null;
    const nextCpu = new Map();
    for (const role of system.processes) {
      let delta = 0;
      for (const member of role.members) { delta += Math.max(0, member.cpuSeconds - (lastCpu.get(member.pid) ?? (lastTime ? 0 : member.cpuSeconds))); nextCpu.set(member.pid, member.cpuSeconds); }
      role.cpuPercentOneCore = elapsed ? 100 * delta / elapsed : null;
      role.cpuPercentMachine = elapsed ? role.cpuPercentOneCore / system.cores : null;
    }
    lastCpu = nextCpu; lastTime = now;
    const record = { ...system, postgres: { ...stats, apiConnections: activity.length, apiActive: activity.filter(row => row.state !== 'idle').length,
      lockWaits: activity.filter(row => row.wait_event_type === 'Lock').length, blocked: activity.filter(row => row.blockers.length).length } };
    samples.push(record); fs.appendFileSync(path.join(dir, 'resources.jsonl'), JSON.stringify(record) + '\n');
    if (Number(system.hostCpuPercent) > 95) highCpuSince ??= now; else highCpuSince = undefined;
    if (Number(system.availableMemoryBytes) < 1024 ** 3 || highCpuSince && now - highCpuSince > 30000) {
      resourceAbort = 'HOST_RESOURCE_LIMIT'; if (generator?.exitCode === null) generator.kill();
    }
  }
  let code, summary, integrity, arrivals;
  try {
    await sample(); if (resourceAbort) throw new Error(resourceAbort);
    const log = fs.openSync(path.join(dir, 'k6.log'), 'wx');
    const childEnv = {};
    for (const key of ['SystemRoot', 'SYSTEMROOT', 'WINDIR', 'PATH', 'Path', 'PATHEXT', 'TEMP', 'TMP', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'COMSPEC', 'NUMBER_OF_PROCESSORS', 'PROCESSOR_ARCHITECTURE']) {
      if (process.env[key] !== undefined) childEnv[key] = process.env[key];
    }
    Object.assign(childEnv, { LOAD_MANIFEST: path.join(dir, 'manifest-private.json'), LOAD_SUMMARY: path.join(dir, 'k6-summary.json'),
      LOAD_DNS_POLICY: dnsPolicy(actualIdentity.apiListenAddress), K6_INSECURE_SKIP_TLS_VERIFY: 'false', K6_NO_USAGE_REPORT: 'true' });
    const safeConfig = path.join(dir, 'k6-config.json');
    save(safeConfig, { insecureSkipTLSVerify: false, noUsageReport: true });
    generator = spawn(values.k6, ['run', '--quiet', '--log-format', 'json', '--config', safeConfig, '--new-machine-readable-summary=false', '--no-usage-report', path.join(ROOT, 'tests/load/scenarios.js')], {
      cwd: dir, env: childEnv, windowsHide: true, stdio: ['ignore', log, log],
    });
    fs.closeSync(log);
    let active = true;
    const sampling = (async () => {
      while (active) {
        await new Promise(resolve => setTimeout(resolve, 2000)); if (!active) break;
        try { await sample(); } catch { sampleFailure = true; generator.kill(); break; }
      }
    })();
    try { code = await new Promise((resolve, reject) => { generator.on('error', reject); generator.on('exit', resolve); }); }
    finally { active = false; await sampling; }
    await sample();
    // Aguarda transações em andamento antes de reconciliar os resultados.
    for (let attempt = 0; attempt < 30; attempt++) {
      const busy = (await monitor.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND application_name=$1 AND state<>'idle'", ['unixs_load_' + state.id])).rows[0].count;
      if (!busy) break; await new Promise(resolve => setTimeout(resolve, 1000));
      if (attempt === 29) throw new Error('LOAD_TRANSACTIONS_NOT_DRAINED');
    }
    summary = JSON.parse(fs.readFileSync(path.join(dir, 'k6-summary.json'), 'utf8'));
    const trace = parseArrivalEvents(fs.readFileSync(path.join(dir, 'k6.log'), 'utf8'));
    arrivals = reconcileArrivals(p.number, summary, trace);
    save(path.join(dir, 'arrival-accounting.json'), arrivals);
    if (arrivals.applicable) fs.writeFileSync(path.join(dir, 'stage-events.jsonl'), trace.events.map(event => JSON.stringify(event) + '\n').join(''), { flag: 'wx' });
    integrity = await verify(state, manifest, dir, summary, arrivals);
  } finally { await monitor.end(); }
  const thresholdFailures = Object.entries(summary.metrics).flatMap(([name, metric]) => Object.entries(metric.thresholds || {}).filter(([, result]) => !result.ok).map(([rule]) => ({ name, rule })));
  const counters = Object.fromEntries(Object.entries(summary.metrics).filter(([name]) => name.endsWith('_requests')).map(([name, metric]) => [name, metric.values.count]));
  const report = { scenario: p.number, repetition: p.repetition, cohort: p.cohort, accountsPrepared: p.accounts,
    k6ExitCode: code, passed: code === 0 && !thresholdFailures.length && !resourceAbort && !sampleFailure && integrity.expectedCountsMatch && arrivals.passed,
    arrivals,
    thresholdFailures, resourceAbort: resourceAbort || null, resourceCollectionFailed: Boolean(sampleFailure),
    requests: summary.metrics.http_reqs.values.count, requestsPerSecond: summary.metrics.http_reqs.values.rate,
    operationSamples: counters, resourceSamples: samples.length,
    postgresDeltas: Object.fromEntries(['xact_commit', 'xact_rollback', 'blks_read', 'blks_hit', 'temp_files', 'temp_bytes', 'deadlocks', 'tup_inserted', 'tup_updated', 'tup_deleted']
      .map(name => [name, Number(samples.at(-1).postgres[name]) - Number(samples[0].postgres[name])])),
    integrity,
    percentilesAreIndicative: Object.values(counters).some(count => count < 1000),
    scope: 'Somente ambiente local; um resultado individual não comprova capacidade institucional.' };
  save(path.join(dir, 'report.json'), report);
  console.log(JSON.stringify(report, null, 2));
  assert.ok(report.passed, 'LOAD_SCENARIO_FAILED');
}
main().catch(cliError);
