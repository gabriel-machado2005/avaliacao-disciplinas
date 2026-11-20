import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveApiBaseUrl } from '../src/api-base-url.ts';

test('mantém a URL HTTP local quando não há configuração', () => {
  assert.equal(resolveApiBaseUrl(), 'http://localhost:3000');
});

test('o padrão acompanha HTTPS sem criar conteúdo misto', () => {
  assert.equal(resolveApiBaseUrl(undefined, 'https:'), 'https://localhost:3000');
});

test('usa a URL configurada e remove barras finais', () => {
  assert.equal(resolveApiBaseUrl('https://localhost:3000///', 'https:'), 'https://localhost:3000');
  assert.equal(resolveApiBaseUrl('https://example.test/api/'), 'https://example.test/api');
});

test('bloqueia API HTTP em página HTTPS', () => {
  assert.throws(() => resolveApiBaseUrl('http://localhost:3000', 'https:'), /API HTTPS/);
});

for (const value of ['', 'localhost:3000', '*', 'ftp://localhost', 'javascript:alert(1)',
  'https://user:password@localhost:3000', 'https://localhost:3000/?token=exemplo',
  'https://localhost:3000/#fragment']) {
  test(`rejeita URL-base inválida: ${value}`, () => {
    assert.throws(() => resolveApiBaseUrl(value), /VITE_API_BASE_URL/);
  });
}
