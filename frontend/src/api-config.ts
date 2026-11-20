import { resolveApiBaseUrl } from './api-base-url';

export const API_BASE_URL = resolveApiBaseUrl(
  import.meta.env.VITE_API_BASE_URL,
  window.location.protocol,
);
