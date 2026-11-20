export function resolveApiBaseUrl(value?: string, pageProtocol = 'http:'): string {
  const fallback = `${pageProtocol === 'https:' ? 'https' : 'http'}://localhost:3000`;
  let url: URL;
  try {
    url = new URL(value ?? fallback);
  } catch {
    throw new Error('VITE_API_BASE_URL deve ser uma URL HTTP ou HTTPS válida.');
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username || url.password || url.search || url.hash
  ) {
    throw new Error('VITE_API_BASE_URL deve ser uma URL HTTP ou HTTPS sem credenciais, consulta ou fragmento.');
  }
  if (pageProtocol === 'https:' && url.protocol !== 'https:') {
    throw new Error('O frontend HTTPS exige uma API HTTPS. Confira VITE_API_BASE_URL.');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}
