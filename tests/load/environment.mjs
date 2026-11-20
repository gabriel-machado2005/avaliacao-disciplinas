import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import https from 'node:https';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { API, DATABASE, DB_PORT } from './plan.mjs';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const PRIVATE_ROOT = path.resolve(ROOT, '..', 'certificados-avaliacao-disciplinas');
export const requireBackend = createRequire(path.join(ROOT, 'backend/package.json'));
export const { Client } = requireBackend('pg');
export const PG_BIN = 'C:/Program Files/PostgreSQL/18/bin';
export const DEFAULT_K6 = path.join(os.homedir(), 'AppData/Local/Programs/k6/2.4.0/k6-v2.4.0-windows-amd64/k6.exe');
export const hash = value => crypto.createHash('sha256').update(value).digest('hex');

export function workspacePath(value) {
  const resolved = path.resolve(value || '');
  if (path.dirname(resolved).toLowerCase() !== PRIVATE_ROOT.toLowerCase() ||
      !/^carga_[0-9TZ_-]+_[a-f0-9]{8}$/.test(path.basename(resolved))) {
    throw new Error('LOAD_WORKSPACE_NOT_ALLOWED');
  }
  if (fs.existsSync(resolved) && fs.realpathSync(resolved).toLowerCase() !== resolved.toLowerCase()) {
    throw new Error('LOAD_WORKSPACE_SYMLINK_NOT_ALLOWED');
  }
  return resolved;
}

export function readState(workspace) {
  const dir = workspacePath(workspace);
  const state = JSON.parse(fs.readFileSync(path.join(dir, 'environment.json'), 'utf8'));
  return validateState(state, dir);
}

export function validateState(state, dir) {
  if (state.kind !== 'UNIXS_LOAD_V1' || state.api !== API || state.db.host !== '127.0.0.1' ||
      state.db.port !== DB_PORT || state.db.name !== DATABASE || state.db.user !== DATABASE ||
      state.dataDirectory !== path.join(dir, 'pgdata') || !state.db.password || !state.jwtSecret ||
      process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0') throw new Error('LOAD_CONFIG_NOT_ALLOWED');
  return { ...state, workspace: dir };
}

export function save(file, value) {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}

export function childEnvironment(state) {
  return { ...process.env, DB_HOST: '127.0.0.1', DB_PORT: String(DB_PORT),
    DB_DATABASE: DATABASE, DB_USERNAME: DATABASE, DB_PASSWORD: state.db.password,
    JWT_SECRET: state.jwtSecret, PGOPTIONS: '', PGAPPNAME: 'unixs_load_' + state.id,
    PORT: '3001', HTTPS_ENABLED: 'true', HTTPS_CERT_PATH: state.cert,
    HTTPS_KEY_PATH: state.key, CORS_ORIGIN: 'https://localhost:5173', NODE_ENV: 'test' };
}

export async function identity(client, state, database = DATABASE) {
  if (![DATABASE, 'postgres'].includes(database)) throw new Error('LOAD_DATABASE_NOT_ALLOWED');
  const actual = (await client.query("SELECT current_database() AS database, inet_server_port() AS port, host(inet_server_addr()) AS address, current_user AS username, current_setting('data_directory') AS directory")).rows[0];
  assert.equal(actual.database, database); assert.equal(actual.port, DB_PORT);
  assert.equal(actual.address, '127.0.0.1'); assert.equal(actual.username, DATABASE);
  assert.equal(fs.realpathSync(actual.directory), fs.realpathSync(state.dataDirectory));
  assert.equal(path.dirname(fs.realpathSync(actual.directory)), fs.realpathSync(state.workspace));
  return actual;
}

export async function connect(state, readOnly = true, database = DATABASE) {
  const client = new Client({ host: '127.0.0.1', port: DB_PORT, database, user: DATABASE,
    password: state.db.password, application_name: 'unixs_load_control',
    options: readOnly ? '-c default_transaction_read_only=on' : '' });
  await client.connect();
  try { await identity(client, state, database); return client; }
  catch (error) { await client.end(); throw error; }
}

export async function freePort(port, host) {
  await new Promise((resolve, reject) => {
    const server = net.createServer(); server.once('error', reject);
    server.listen(port, host, () => server.close(resolve));
  });
}

export function command(executable, args, env, log, timeout = 180000) {
  const fd = fs.openSync(log, 'wx'); let result;
  try { result = spawnSync(executable, args, { env, cwd: path.join(ROOT, 'backend'),
    windowsHide: true, stdio: ['ignore', fd, fd], timeout }); }
  finally { fs.closeSync(fd); }
  if (result.error || result.status !== 0) throw new Error('LOAD_COMMAND_FAILED_' + path.basename(log));
}

export function api(state, route, { method = 'GET', token, body } = {}) {
  if (state.api !== API || !route.startsWith('/') || route.startsWith('//')) throw new Error('LOAD_URL_NOT_ALLOWED');
  return new Promise((resolve, reject) => {
    const request = https.request(new URL(route, API), { method, agent: false,
      rejectUnauthorized: true, timeout: 10000,
      headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    }, response => {
      let text = ''; response.setEncoding('utf8'); response.on('data', chunk => text += chunk);
      const socket = response.socket;
      const fingerprint = socket.getPeerCertificate().fingerprint256;
      const authorized = socket.authorized;
      response.on('end', () => {
        try {
          assert.ok(authorized); assert.equal(fingerprint, state.fingerprint);
          resolve({ status: response.statusCode, body: text && response.headers['content-type']?.includes('application/json') ? JSON.parse(text) : text });
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('LOAD_API_TIMEOUT')));
    request.on('error', reject); request.end(body ? JSON.stringify(body) : undefined);
  });
}

export async function login(state, account) {
  const response = await api(state, '/auth/login', { method: 'POST', body: { email: account.email, password: account.password } });
  assert.equal(response.status, 201); assert.ok(response.body.accessToken);
  return response.body.accessToken;
}

export function portOwners() {
  const script = "@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(3001,55487) } | Select-Object LocalAddress,LocalPort,OwningProcess) | ConvertTo-Json -Compress";
  const result = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error('LOAD_PORT_CHECK_FAILED');
  const parsed = JSON.parse(result.stdout || '[]'); return Array.isArray(parsed) ? parsed : [parsed];
}

export async function preflight(state) {
  const client = await connect(state); let actual;
  try { actual = await identity(client, state); } finally { await client.end(); }
  const owners = portOwners();
  assert.ok(owners.some(item => item.LocalPort === 3001 && item.OwningProcess === state.apiPid && ['::1', '127.0.0.1'].includes(item.LocalAddress)));
  assert.ok(owners.some(item => item.LocalPort === DB_PORT && item.OwningProcess === state.pgPid && item.LocalAddress === '127.0.0.1'));
  const response = await api(state, '/'); assert.equal(response.status, 200);
  return { ...actual, apiListenAddress: owners.find(item => item.LocalPort === 3001 && item.OwningProcess === state.apiPid).LocalAddress };
}

export function dnsPolicy(address) {
  if (address === '::1') return 'onlyIPv6';
  if (address === '127.0.0.1') return 'onlyIPv4';
  throw new Error('LOAD_NON_LOOPBACK_ADDRESS');
}

export async function services(state, work) {
  const guard = await connect(state); await guard.end();
  Object.assign(process.env, childEnvironment(state));
  requireBackend('reflect-metadata');
  const { NestFactory } = requireBackend('@nestjs/core');
  const { AppModule } = requireBackend('./dist/app.module.js');
  const { DataSource } = requireBackend('typeorm');
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
  try {
    const db = app.get(DataSource);
    await identity({ query: (...args) => db.query(...args).then(rows => ({ rows })) }, state);
    await work(app, db);
  } finally { await app.close(); }
}

export function cliError(error) {
  const safeReason = /^LOAD_[A-Z0-9_]+$/.test(error.message || '') ? error.message : error.name;
  console.error('LOAD_OPERATION_FAILED: ' + (error.code || safeReason)); process.exitCode = 1;
}
