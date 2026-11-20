import crypto from 'node:crypto';
import fs from 'node:fs';
import tls from 'node:tls';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

type Environment = Record<string, string | undefined>;

export function getTransportConfig(env: Environment) {
  if (env.HTTPS_ENABLED !== undefined && !['true', 'false'].includes(env.HTTPS_ENABLED)) {
    throw new Error('HTTPS_ENABLED deve ser true ou false.');
  }
  const secure = env.HTTPS_ENABLED === 'true';
  const port = env.PORT ?? '3000';
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error('PORT deve ser uma porta entre 1 e 65535.');
  }

  const origin = env.CORS_ORIGIN ?? `${secure ? 'https' : 'http'}://localhost:5173`;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    throw new Error('CORS_ORIGIN deve ser uma origem HTTP ou HTTPS válida.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    (secure && url.protocol !== 'https:')
  ) {
    throw new Error('CORS_ORIGIN deve conter apenas uma origem válida; use HTTPS quando habilitado.');
  }
  const cors: CorsOptions = {
    origin: url.origin,
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
  };

  let httpsOptions: tls.SecureContextOptions | undefined;
  if (secure) {
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
    httpsOptions = { cert, key, minVersion: 'TLSv1.2' };
    let certificate: crypto.X509Certificate;
    try {
      tls.createSecureContext(httpsOptions);
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
  }

  return { host: 'localhost', port: Number(port), cors, httpsOptions };
}
