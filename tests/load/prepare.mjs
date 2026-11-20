import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { setTimeout as wait } from 'node:timers/promises';
import { API, DATABASE, DB_PORT, budget } from './plan.mjs';
import { ROOT, PRIVATE_ROOT, PG_BIN, workspacePath, save, hash, freePort, connect,
  command, childEnvironment, api, identity, cliError } from './environment.mjs';
import { seedCommon } from './fixtures.mjs';

async function main() {
  const { values } = parseArgs({ options: { workspace: { type: 'string' }, schema: { type: 'string' } } });
  const workspace = workspacePath(values.workspace);
  if (fs.existsSync(workspace) || !values.schema) throw new Error('LOAD_FRESH_WORKSPACE_AND_SCHEMA_REQUIRED');
  await freePort(DB_PORT, '127.0.0.1'); await freePort(3001, 'localhost');
  const schemaPath = fs.realpathSync(values.schema);
  if (schemaPath.toLowerCase().startsWith(path.resolve(ROOT).toLowerCase() + path.sep)) throw new Error('LOAD_SCHEMA_MUST_BE_EXTERNAL');
  let schema = fs.readFileSync(schemaPath, 'utf8');
  if (/^\s*(?:INSERT\s+INTO|COPY\s|TRUNCATE\s|DROP\s|CREATE\s+DATABASE|ALTER\s+DATABASE|\\connect\b)/im.test(schema)) throw new Error('LOAD_SCHEMA_NOT_DDL_ONLY');
  schema = schema.replace(/^CREATE SCHEMA public;$/gm, 'CREATE SCHEMA IF NOT EXISTS public;');
  const cert = path.join(PRIVATE_ROOT, 'localhost.pem'), key = path.join(PRIVATE_ROOT, 'localhost-key.pem');
  const fingerprint = new crypto.X509Certificate(fs.readFileSync(cert)).fingerprint256;
  fs.mkdirSync(workspace);
  const state = { kind: 'UNIXS_LOAD_V1', id: crypto.randomUUID(), workspace, api: API,
    dataDirectory: path.join(workspace, 'pgdata'), cert, key, fingerprint,
    db: { host: '127.0.0.1', port: DB_PORT, name: DATABASE, user: DATABASE, password: crypto.randomBytes(32).toString('hex') },
    jwtSecret: crypto.randomBytes(32).toString('hex'), schemaHash: hash(schema), apiPid: null, pgPid: null };
  save(path.join(workspace, 'allocation-plan.json'), { budget, accountsPerFullCycle: 7000, allThreeRepetitions: 21000, historicalStudents: 200, preparationExcludedFromMeasurement: true });
  const env = { ...childEnvironment(state), PGPASSWORD: state.db.password };
  const passwordFile = path.join(workspace, 'init-password.tmp');
  fs.writeFileSync(passwordFile, state.db.password + '\n', { flag: 'wx' });
  try {
    command(path.join(PG_BIN, 'initdb.exe'), ['-D', state.dataDirectory, '-U', DATABASE, '-A', 'scram-sha-256', '--pwfile=' + passwordFile, '--encoding=UTF8', '--locale=C'], env, path.join(workspace, 'initdb.log'));
  } finally { fs.unlinkSync(passwordFile); }
  command(path.join(PG_BIN, 'pg_ctl.exe'), ['-D', state.dataDirectory, '-l', path.join(workspace, 'postgresql.log'), '-o', '-p 55487 -h 127.0.0.1', '-w', '-t', '30', 'start'], env, path.join(workspace, 'postgres-start.log'));
  state.pgPid = Number(fs.readFileSync(path.join(state.dataDirectory, 'postmaster.pid'), 'utf8').split(/\r?\n/)[0]);
  const bootstrap = await connect(state, false, 'postgres');
  try { await identity(bootstrap, state, 'postgres'); await bootstrap.query('CREATE DATABASE unixs_load_test'); }
  finally { await bootstrap.end(); }
  const client = await connect(state, false);
  try {
    save(path.join(workspace, 'identity-before-write.json'), await identity(client, state));
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  } finally { await client.end(); }
  const ddl = path.join(workspace, 'schema.sql'); fs.writeFileSync(ddl, schema, { flag: 'wx' });
  command(path.join(PG_BIN, 'psql.exe'), ['-h', '127.0.0.1', '-p', '55487', '-U', DATABASE, '-d', DATABASE, '--no-password', '-v', 'ON_ERROR_STOP=on', '--single-transaction', '-f', ddl], env, path.join(workspace, 'schema-load.log'));
  const empty = await connect(state);
  try {
    const tables = (await empty.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
    if (tables.length !== 16) throw new Error('LOAD_SCHEMA_TABLE_COUNT');
    for (const { tablename } of tables) {
      if (Number((await empty.query('SELECT count(*) AS count FROM public."' + tablename.replace(/"/g, '""') + '"')).rows[0].count)) throw new Error('LOAD_DATABASE_NOT_EMPTY');
    }
  } finally { await empty.end(); }
  save(path.join(workspace, 'environment.json'), state);
  await seedCommon(state);
  const out = fs.openSync(path.join(workspace, 'api.stdout.log'), 'wx');
  const err = fs.openSync(path.join(workspace, 'api.stderr.log'), 'wx');
  const child = spawn(process.execPath, ['--use-system-ca', path.join(ROOT, 'tests/load/server.mjs'), workspace], {
    cwd: path.join(ROOT, 'backend'), env: childEnvironment(state), detached: true, windowsHide: true, stdio: ['ignore', out, err],
  });
  child.unref(); fs.closeSync(out); fs.closeSync(err); state.apiPid = child.pid;
  fs.writeFileSync(path.join(workspace, 'environment.json'), JSON.stringify(state, null, 2) + '\n');
  let ready = false;
  for (let attempt = 0; attempt < 45; attempt++) {
    try { ready = (await api(state, '/')).status === 200; if (ready) break; } catch { /* aguarda a inicialização */ }
    await wait(1000);
  }
  if (!ready) throw new Error('LOAD_API_NOT_READY');
  console.log(JSON.stringify({ workspace, api: API, database: DATABASE, port: DB_PORT, tables: 16, realRecordsCopied: 0, commonFixturesReady: true, historicalStudents: 200, scenariosExecuted: 0 }));
}
main().catch(cliError);
