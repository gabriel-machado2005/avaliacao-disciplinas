import fs from 'node:fs';
import path from 'node:path';
import { readState, preflight, PG_BIN, command, childEnvironment, cliError } from './environment.mjs';

async function main() {
  const state = readState(process.argv[2]);
  await preflight(state);
  // Só o PID da API validado e o diretório do cluster confirmado são encerrados.
  process.kill(state.apiPid);
  command(path.join(PG_BIN, 'pg_ctl.exe'), ['-D', state.dataDirectory, '-m', 'fast', '-w', '-t', '30', 'stop'],
    childEnvironment(state), path.join(state.workspace, 'postgres-stop-' + Date.now() + '.log'));
  fs.writeFileSync(path.join(state.workspace, 'stopped.json'), JSON.stringify({ stoppedAt: new Date().toISOString() }) + '\n', { flag: 'wx' });
  console.log('LOAD_ENVIRONMENT_STOPPED');
}
main().catch(cliError);
