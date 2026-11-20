import { readState, connect, childEnvironment, requireBackend, cliError } from './environment.mjs';

async function main() {
  const state = readState(process.argv[2]);
  const client = await connect(state); await client.end();
  Object.assign(process.env, childEnvironment(state));
  // Mesma inicialização da aplicação, após validar o destino isolado.
  requireBackend('./dist/main.js');
}
main().catch(cliError);
