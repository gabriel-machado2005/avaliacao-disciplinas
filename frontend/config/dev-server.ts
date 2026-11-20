import crypto from 'node:crypto';
import fs from 'node:fs';
import tls from 'node:tls';
import { resolveApiBaseUrl } from '../src/api-base-url.ts';

export function getDevServerConfig(env: Record<string, string | undefined>, command: string) {
  const server: { host: string; port: number; strictPort: boolean; https?: tls.SecureContextOptions } = {
    host: 'localhost', port: 5173, strictPort: true,
  };
  if (env.HTTPS_ENABLED !== undefined && !['true', 'false'].includes(env.HTTPS_ENABLED)) {
    throw new Error('HTTPS_ENABLED deve ser true ou false.');
  }
  const secure = env.HTTPS_ENABLED === 'true';
  resolveApiBaseUrl(env.VITE_API_BASE_URL, secure ? 'https:' : 'http:');
  // Builds não iniciam um servidor TLS nem precisam de chaves locais.
  if (command !== 'serve' || !secure) return server;

  if (!env.HTTPS_CERT_PATH || !env.HTTPS_KEY_PATH) {
    throw new Error('HTTPS exige HTTPS_CERT_PATH e HTTPS_KEY_PATH.');
  }
  let cert: Buffer;
  let key: Buffer;
  try {
    cert = fs.readFileSync(env.HTTPS_CERT_PATH);
    key = fs.readFileSync(env.HTTPS_KEY_PATH);
  } catch {
    throw new Error('Não foi possível ler HTTPS_CERT_PATH ou HTTPS_KEY_PATH.');
  }
  server.https = { cert, key, minVersion: 'TLSv1.2' };
  let certificate: crypto.X509Certificate;
  try {
    tls.createSecureContext(server.https);
    certificate = new crypto.X509Certificate(cert);
  } catch {
    throw new Error('Certificado ou chave TLS inválidos ou incompatíveis.');
  }
  const now = Date.now();
  if (now < Date.parse(certificate.validFrom) || now > Date.parse(certificate.validTo)) {
    throw new Error('O certificado TLS está fora do prazo de validade.');
  }
  if (!certificate.checkHost('localhost')) {
    throw new Error('O certificado TLS deve incluir localhost.');
  }
  return server;
}
