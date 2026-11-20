import crypto from 'node:crypto';
import fs from 'node:fs';
import tls from 'node:tls';
import { getTransportConfig } from './transport-config';

describe('Configuração de transporte local', () => {
  const secure = {
    HTTPS_ENABLED: 'true',
    HTTPS_CERT_PATH: 'certificado-de-teste',
    HTTPS_KEY_PATH: 'chave-de-teste',
  };

  afterEach(() => jest.restoreAllMocks());

  function mockCertificate(validFrom = '2020-01-01', validTo = '2099-01-01', hostname = 'localhost') {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('material TLS simulado'));
    jest.spyOn(tls, 'createSecureContext').mockReturnValue({} as tls.SecureContext);
    jest.spyOn(crypto, 'X509Certificate').mockImplementation(() => ({
      validFrom, validTo, checkHost: () => hostname,
    }) as unknown as crypto.X509Certificate);
  }

  it('preserva HTTP, porta 3000 e restringe o servidor ao localhost', () => {
    const config = getTransportConfig({});
    expect(config).toMatchObject({ host: 'localhost', port: 3000 });
    expect(config.httpsOptions).toBeUndefined();
    expect(config.cors).toEqual({
      origin: 'http://localhost:5173',
      methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      credentials: false,
    });
  });

  it('não lê certificados no modo HTTP explícito', () => {
    const read = jest.spyOn(fs, 'readFileSync');
    expect(getTransportConfig({ ...secure, HTTPS_ENABLED: 'false' }).httpsOptions).toBeUndefined();
    expect(read).not.toHaveBeenCalled();
  });

  it('aceita porta e uma origem explícita, sem liberar outras origens', () => {
    expect(getTransportConfig({ PORT: '3001', CORS_ORIGIN: 'http://localhost:5173/' }))
      .toMatchObject({ port: 3001, cors: { origin: 'http://localhost:5173' } });
  });

  it.each(['0', '65536', 'abc', '3000.5', '-1', ''])('rejeita PORT=%p', (PORT) => {
    expect(() => getTransportConfig({ PORT })).toThrow('PORT');
  });

  it.each(['1', 'TRUE', 'yes', ''])('rejeita ativação ambígua %p', (HTTPS_ENABLED) => {
    expect(() => getTransportConfig({ HTTPS_ENABLED })).toThrow('HTTPS_ENABLED');
  });

  it.each(['*', 'null', 'javascript:alert(1)', 'https://localhost:5173/path',
    'https://user:password@localhost:5173', 'https://localhost:5173?q=1',
    'https://localhost:5173/#fragment', 'http://localhost:5173,https://localhost:5173'])
  ('rejeita CORS_ORIGIN inválida %p', (CORS_ORIGIN) => {
    expect(() => getTransportConfig({ CORS_ORIGIN })).toThrow('CORS_ORIGIN');
  });

  it('rejeita origem HTTP quando o backend usa HTTPS', () => {
    expect(() => getTransportConfig({ ...secure, CORS_ORIGIN: 'http://localhost:5173' })).toThrow('CORS_ORIGIN');
  });

  it.each(['HTTPS_CERT_PATH', 'HTTPS_KEY_PATH'])('exige %s em HTTPS', (field) => {
    expect(() => getTransportConfig({ ...secure, [field]: undefined })).toThrow('HTTPS exige');
  });

  it('falha se não conseguir ler os arquivos, sem expor seu conteúdo', () => {
    jest.spyOn(fs, 'readFileSync').mockImplementation(() => { throw new Error('conteúdo privado'); });
    expect(() => getTransportConfig(secure)).toThrow('Não foi possível ler');
    expect(() => getTransportConfig(secure)).not.toThrow('conteúdo privado');
  });

  it('rejeita material PEM inválido usando a validação TLS real', () => {
    jest.spyOn(fs, 'readFileSync').mockReturnValue(Buffer.from('não é um certificado ou chave'));
    expect(() => getTransportConfig(secure)).toThrow('inválidos ou incompatíveis');
  });

  it('interrompe em caso de erro TLS, sem retornar configuração HTTP', () => {
    mockCertificate();
    jest.spyOn(tls, 'createSecureContext').mockImplementation(() => { throw new Error('key mismatch'); });
    expect(() => getTransportConfig(secure)).toThrow('inválidos ou incompatíveis');
  });

  it.each([['2000-01-01', '2001-01-01'], ['2098-01-01', '2099-01-01']])
  ('rejeita certificado fora da validade (%s a %s)', (from, to) => {
    mockCertificate(from, to);
    expect(() => getTransportConfig(secure)).toThrow('prazo de validade');
  });

  it('rejeita certificado que não inclui localhost', () => {
    mockCertificate('2020-01-01', '2099-01-01', '');
    expect(() => getTransportConfig(secure)).toThrow('incluir localhost');
  });

  it('configura HTTPS e CORS com material simulado sem instalar certificados', () => {
    mockCertificate();
    const config = getTransportConfig(secure);
    expect(config).toMatchObject({
      host: 'localhost', port: 3000, cors: { origin: 'https://localhost:5173' },
      httpsOptions: { minVersion: 'TLSv1.2' },
    });
    expect(tls.createSecureContext).toHaveBeenCalledWith(config.httpsOptions);
    expect(fs.readFileSync).toHaveBeenNthCalledWith(1, secure.HTTPS_CERT_PATH);
    expect(fs.readFileSync).toHaveBeenNthCalledWith(2, secure.HTTPS_KEY_PATH);
  });
});
