import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { COMMENT, payload } from './plan.mjs';
import { connect, api, login, preflight, save } from './environment.mjs';
import { expectedSubmissionsMatch } from './arrival-accounting.mjs';

export async function verify(state, manifest, dir, summary, arrivals = { applicable: false, passed: true }) {
  await preflight(state);
  const common = JSON.parse(fs.readFileSync(path.join(state.workspace, 'common-private.json'), 'utf8'));
  const metric = name => summary.metrics[name]?.values.count || 0;
  const accepted = metric('submissions_accepted');
  const client = await connect(state);
  let totals, completedAccount;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const ids = manifest.evaluationIds;
    const scalar = async (sql, values = []) => Number((await client.query(sql, values)).rows[0].count);
    const submissions = await scalar('SELECT count(*) AS count FROM submissions WHERE evaluation_id=ANY($1::uuid[])', [ids]);
    const completed = await scalar('SELECT count(*) AS count FROM evaluation_eligibilities WHERE evaluation_id=ANY($1::uuid[]) AND completed', [ids]);
    const answers = await scalar('SELECT count(*) AS count FROM answers a JOIN submissions s ON s.id=a.submission_id WHERE s.evaluation_id=ANY($1::uuid[])', [ids]);
    assert.equal(submissions, accepted); assert.equal(completed, accepted); assert.equal(answers, accepted * manifest.questions.length);
    completedAccount = (await client.query('SELECT u.email FROM evaluation_eligibilities e JOIN users u ON u.id=e.student_id WHERE e.evaluation_id=ANY($1::uuid[]) AND e.completed LIMIT 1', [ids])).rows[0]?.email;
    const perEvaluation = (await client.query('SELECT e.evaluation_id,(SELECT count(*)::int FROM submissions s WHERE s.evaluation_id=e.evaluation_id) AS submissions,count(*) FILTER (WHERE completed)::int AS completed FROM evaluation_eligibilities e WHERE evaluation_id=ANY($1::uuid[]) GROUP BY evaluation_id', [ids])).rows;
    for (const row of perEvaluation) assert.equal(row.submissions, row.completed);
    assert.equal(await scalar('SELECT count(*) AS count FROM (SELECT a.submission_id,a.question_id FROM answers a JOIN submissions s ON s.id=a.submission_id WHERE s.evaluation_id=ANY($1::uuid[]) GROUP BY a.submission_id,a.question_id HAVING count(*)>1) d', [ids]), 0);
    assert.equal(await scalar('SELECT count(*) AS count FROM answers a LEFT JOIN submissions s ON s.id=a.submission_id LEFT JOIN questions q ON q.id=a.question_id WHERE s.id IS NULL OR q.id IS NULL'), 0);
    assert.equal(await scalar('SELECT count(*) AS count FROM answers a JOIN submissions s ON s.id=a.submission_id JOIN evaluations e ON e.id=s.evaluation_id JOIN questions q ON q.id=a.question_id JOIN dimensions d ON d.id=q.dimension_id WHERE d.questionnaire_id<>e.questionnaire_id'), 0);
    const foreignKeys = (await client.query(`SELECT c.convalidated, c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent,
      ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n,o) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.n ORDER BY k.o) AS childcols,
      ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n,o) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.n ORDER BY k.o) AS parentcols
      FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='public' AND c.contype='f'`)).rows;
    assert.equal(foreignKeys.length, 21); assert.ok(foreignKeys.every(fk => fk.convalidated));
    const quote = value => '"' + value.replaceAll('"', '""') + '"';
    for (const fk of foreignKeys) {
      // Nomes provenientes do catálogo, sem parâmetros de usuário. Não consulta outros bancos.
      const nonNull = fk.childcols.map(column => 'c.' + quote(column) + ' IS NOT NULL').join(' AND ');
      const relation = fk.childcols.map((column, i) => 'p.' + quote(fk.parentcols[i]) + '=c.' + quote(column)).join(' AND ');
      assert.equal(await scalar('SELECT count(*) AS count FROM ' + fk.child + ' c WHERE ' + nonNull +
        ' AND NOT EXISTS (SELECT 1 FROM ' + fk.parent + ' p WHERE ' + relation + ')'), 0);
    }
    const columns = (await client.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('answers','submissions')")).rows;
    assert.ok(!columns.some(row => /student|email|password|token/i.test(row.column_name)));
    const aggregates = (await client.query('SELECT a.question_id,count(*)::int AS responses,avg(scale_value)::float AS average FROM answers a JOIN submissions s ON s.id=a.submission_id WHERE s.evaluation_id=ANY($1::uuid[]) GROUP BY question_id', [ids])).rows;
    for (const row of aggregates) { assert.equal(row.responses, accepted); if (row.average !== null) assert.equal(row.average, 3); }
    totals = { submissions, completed, answers, duplicateAnswerPairs: 0, orphanAnswers: 0, orphanReferences: 0, validatedForeignKeys: 21, identityColumnsInAnonymousTables: 0 };
    await client.query('COMMIT');
  } finally { await client.end(); }
  const expectedCountsMatch = expectedSubmissionsMatch(manifest.scenario, accepted, manifest.plan.journeys, arrivals);

  const administrator = await login(state, common.admin);
  const coordinator = await login(state, common.coordinator);
  const professor = await login(state, common.professor);
  const outsider = await login(state, common.outsider);
  const replayAccount = manifest.students.find(account => account.email === completedAccount) || manifest.students[0];
  const student = await login(state, replayAccount);
  let replaysRejected = 0;
  if (accepted) {
    // Uma checagem funcional fora da janela de carga, sem gravar nova resposta.
    const replay = await api(state, '/evaluations/' + replayAccount.evaluationId + '/submissions', { method: 'POST', token: student, body: payload(manifest.questions) });
    assert.equal(replay.status, 400); assert.equal(replay.body.message, 'Esta avaliação já foi respondida.'); replaysRejected++;
  }
  const route = '/evaluations/' + common.closedEvaluations[0] + '/results';
  assert.equal((await api(state, route, { token: student })).status, 403);
  assert.equal((await api(state, route, { token: outsider })).status, 403);
  assert.equal((await api(state, route)).status, 401);
  assert.equal((await api(state, route, { token: professor })).status, 200);
  assert.equal((await api(state, route, { token: administrator })).status, 200);
  const result = await api(state, route, { token: coordinator }); assert.equal(result.status, 200);
  assert.equal(result.body.participation.responses, 200);
  assert.ok(!JSON.stringify(result.body).includes(COMMENT));
  const questions = result.body.dimensions.flatMap(d => d.questions);
  for (const question of questions) {
    assert.ok(!('comments' in question));
    if (question.id === manifest.questions[18].id) {
      assert.equal(question.status, 'PROTECTED');
      for (const field of ['responses', 'average', 'distribution']) assert.ok(!(field in question));
    }
    else if (question.type === 'TEXT') assert.equal(question.status, 'COMMENTS_PROTECTED');
    else { assert.equal(question.status, 'AVAILABLE'); assert.equal(question.responses, 200); if (question.type === 'SCALE') { assert.equal(question.average, 3); assert.equal(question.distribution['3'], 200); } else assert.equal(question.distribution.Bom, 200); }
  }
  assert.ok(!/studentId|student_id|passwordHash|accessToken/.test(JSON.stringify(result.body)));
  const emptyOptional = await api(state, '/evaluations/' + common.closedEvaluations[1] + '/results', { token: coordinator });
  assert.equal(emptyOptional.body.dimensions.flatMap(d => d.questions).find(q => q.id === manifest.questions[18].id).status, 'NO_RESPONSES');
  assert.equal((await api(state, '/evaluations/' + common.closedEvaluations[2] + '/results', { token: coordinator })).status, 400);
  assert.equal((await api(state, '/evaluations/' + manifest.evaluationIds[0] + '/results', { token: coordinator })).status, 400);
  const historical = await api(state, '/evaluations/analysis' + manifest.comparisonQuery, { token: coordinator });
  assert.equal(historical.status, 200); assert.ok(historical.body.periods.every(p => p.status === 'AVAILABLE'));
  assert.ok(!JSON.stringify(historical.body).includes(COMMENT));
  const report = { verifiedAt: new Date().toISOString(), ...totals, acknowledgedSubmissions: accepted, expectedCountsMatch,
    replayChecksRejected: replaysRejected, permissionsVerified: true, protectedResultsVerified: true,
    historicalResultsVerified: true, protectedCommentsVerified: true, onlyFictionalData: true };
  save(path.join(dir, 'integrity.json'), report);
  return report;
}
