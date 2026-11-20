import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import tls from 'node:tls';
import { afterEach, mock, test } from 'node:test';
import { getDevServerConfig } from '../config/dev-server.ts';

const secure = {
  HTTPS_ENABLED: 'true',
  HTTPS_CERT_PATH: 'certificado-de-teste',
  HTTPS_KEY_PATH: 'chave-de-teste',
  VITE_API_BASE_URL: 'https://localhost:3000',
};

afterEach(() => mock.restoreAll());

function mockCertificate(validFrom = '2020-01-01', validTo = '2099-01-01', hostname = 'localhost') {
  mock.method(fs, 'readFileSync', () => Buffer.from('material TLS simulado'));
  mock.method(tls, 'createSecureContext', () => ({}));
  mock.method(crypto, 'X509Certificate', function () {
    return { validFrom, validTo, checkHost: () => hostname };
  });
}

test('HTTP usa localhost, porta 5173 fixa e não lê chaves', () => {
  const read = mock.method(fs, 'readFileSync');
  assert.deepEqual(getDevServerConfig({}, 'serve'), {
    host: 'localhost', port: 5173, strictPort: true,
  });
  assert.equal(read.mock.callCount(), 0);
});

test('HTTP explícito não depende de certificados', () => {
  assert.equal(getDevServerConfig({ HTTPS_ENABLED: 'false' }, 'serve').https, undefined);
});

test('build HTTPS não exige caminhos nem lê certificados', () => {
  const read = mock.method(fs, 'readFileSync', () => { throw new Error('não deve ler chaves'); });
  const config = getDevServerConfig({ HTTPS_ENABLED: 'true', VITE_API_BASE_URL: 'https://localhost:3000' }, 'build');
  assert.equal(config.https, undefined);
  assert.equal(read.mock.callCount(), 0);
});

test('build não tenta ler nem mesmo caminhos de certificados inexistentes', () => {
  const read = mock.method(fs, 'readFileSync', () => { throw new Error('não deve ler chaves'); });
  assert.equal(getDevServerConfig(secure, 'build').https, undefined);
  assert.equal(read.mock.callCount(), 0);
});

for (const HTTPS_ENABLED of ['1', 'TRUE', 'yes', '']) {
  test(`rejeita HTTPS_ENABLED ambíguo: ${HTTPS_ENABLED}`, () => {
    assert.throws(() => getDevServerConfig({ HTTPS_ENABLED }, 'serve'), /HTTPS_ENABLED/);
  });
}

test('rejeita API HTTP no modo HTTPS antes de ler chaves', () => {
  const read = mock.method(fs, 'readFileSync');
  assert.throws(() => getDevServerConfig({ ...secure, VITE_API_BASE_URL: 'http://localhost:3000' }, 'serve'), /API HTTPS/);
  assert.equal(read.mock.callCount(), 0);
});

test('build também rejeita URL de API incompatível com HTTPS', () => {
  assert.throws(() => getDevServerConfig({ ...secure, VITE_API_BASE_URL: 'http://localhost:3000' }, 'build'), /API HTTPS/);
});

for (const field of ['HTTPS_CERT_PATH', 'HTTPS_KEY_PATH']) {
  test(`HTTPS exige ${field}`, () => {
    assert.throws(() => getDevServerConfig({ ...secure, [field]: undefined }, 'serve'), /HTTPS exige/);
  });
}

test('falha ao ler arquivos sem expor detalhes internos', () => {
  mock.method(fs, 'readFileSync', () => { throw new Error('conteúdo privado'); });
  assert.throws(() => getDevServerConfig(secure, 'serve'), /^Error: Não foi possível ler/);
});

test('rejeita PEM inválido com a validação TLS real', () => {
  mock.method(fs, 'readFileSync', () => Buffer.from('não é um certificado ou chave'));
  assert.throws(() => getDevServerConfig(secure, 'serve'), /inválidos ou incompatíveis/);
});

test('não retorna para HTTP quando certificado e chave são incompatíveis', () => {
  mockCertificate();
  mock.method(tls, 'createSecureContext', () => { throw new Error('key mismatch'); });
  assert.throws(() => getDevServerConfig(secure, 'serve'), /inválidos ou incompatíveis/);
});

for (const [from, to] of [['2000-01-01', '2001-01-01'], ['2098-01-01', '2099-01-01']]) {
  test(`rejeita certificado fora da validade: ${from} a ${to}`, () => {
    mockCertificate(from, to);
    assert.throws(() => getDevServerConfig(secure, 'serve'), /prazo de validade/);
  });
}

test('rejeita certificado sem localhost', () => {
  mockCertificate('2020-01-01', '2099-01-01', '');
  assert.throws(() => getDevServerConfig(secure, 'serve'), /incluir localhost/);
});

test('configura HTTPS simulado sem instalar autoridade ou gravar chave', () => {
  mockCertificate();
  const config = getDevServerConfig(secure, 'serve');
  assert.equal(config.host, 'localhost');
  assert.equal(config.port, 5173);
  assert.equal(config.strictPort, true);
  assert.equal(config.https.minVersion, 'TLSv1.2');
  assert.deepEqual(config.https.cert, Buffer.from('material TLS simulado'));
  assert.deepEqual(config.https.key, Buffer.from('material TLS simulado'));
});
