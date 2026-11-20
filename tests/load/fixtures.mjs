import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { allocation, payload, API } from './plan.mjs';
import { services, requireBackend, save, connect, preflight } from './environment.mjs';

function types() {
  return {
    Users: requireBackend('./dist/users/users.service.js').UsersService,
    Academic: requireBackend('./dist/academic/academic.service.js').AcademicService,
    Questionnaires: requireBackend('./dist/questionnaires/questionnaires.service.js').QuestionnairesService,
    Evaluations: requireBackend('./dist/evaluations/evaluations.service.js').EvaluationsService,
    User: requireBackend('./dist/users/entities/user.entity.js').User,
    Eligibility: requireBackend('./dist/evaluations/entities/evaluation-eligibility.entity.js').EvaluationEligibility,
    Submission: requireBackend('./dist/evaluations/entities/submission.entity.js').Submission,
    Answer: requireBackend('./dist/evaluations/entities/answer.entity.js').Answer,
  };
}

async function account(users, email, role) {
  const password = (await import('node:crypto')).randomBytes(20).toString('hex');
  const user = await users.create({ name: 'Conta fictícia de carga', email, password, role });
  return { id: user.id, email, password };
}

export async function seedCommon(state) {
  await services(state, async (app, db) => {
    const t = types(), users = app.get(t.Users), academic = app.get(t.Academic);
    const qs = app.get(t.Questionnaires), ev = app.get(t.Evaluations);
    const admin = await account(users, 'admin@carga.example.test', 'ADMIN');
    const coordinator = await account(users, 'coordenacao@carga.example.test', 'COORDINATOR');
    const professor = await account(users, 'professor@carga.example.test', 'PROFESSOR');
    const outsider = await account(users, 'outro-professor@carga.example.test', 'PROFESSOR');
    const course = await academic.createCourse({ code: 'CARGA', name: 'Curso fictício' });
    const discipline = await academic.createDiscipline({ code: 'DISC-CARGA', name: 'Disciplina fictícia', courseId: course.id });
    const term = await academic.createAcademicTerm({ code: 'CARGA-2020', startDate: '2020-01-01', endDate: '2020-12-31' });
    const classes = [];
    for (let i = 0; i < 3; i++) classes.push(await academic.createClassGroup({ code: 'T-CARGA-' + i, disciplineId: discipline.id, academicTermId: term.id, professorId: professor.id }));
    const questionnaire = await qs.createQuestionnaire({ name: 'Questionário fictício de carga' });
    const dimensions = [];
    for (let i = 0; i < 3; i++) dimensions.push(await qs.createDimension(questionnaire.id, { name: 'Dimensão ' + (i + 1), order: i }));
    const questions = [];
    for (let i = 0; i < 20; i++) {
      const type = i < 15 || i === 18 ? 'SCALE' : i < 18 ? 'SINGLE_CHOICE' : 'TEXT';
      const question = await qs.createQuestion(dimensions[i % 3].id, { text: 'Pergunta fictícia ' + (i + 1), type,
        required: i < 18, order: i, ...(type === 'SCALE' ? { scaleMin: 1, scaleMax: 5 } : type === 'SINGLE_CHOICE' ? { options: ['Bom', 'Regular'] } : {}) });
      questions.push({ id: question.id, type, required: i < 18 });
    }
    const periods = [], evaluations = [];
    for (const [name, startDate, endDate] of [['Histórico A', '2020-03-01', '2020-03-10'], ['Histórico B', '2020-06-01', '2020-06-10'], ['Insuficiente', '2020-09-01', '2020-09-10']]) {
      const period = await ev.createPeriod({ name, startDate, endDate }); periods.push(period.id);
      evaluations.push(await ev.createEvaluation({ evaluationPeriodId: period.id, classGroupId: classes[0].id, questionnaireId: questionnaire.id, minResponsesForResults: 5 }));
    }
    const historical = [];
    for (let i = 0; i < 200; i++) historical.push(await account(users, 'historico' + i + '@carga.example.test', 'STUDENT'));
    // Fixtures históricas fora da medição: mesmo modelo usado na suíte HTTP.
    // Não existe ligação estudante -> submissão nestas inserções.
    for (let p = 0; p < 3; p++) {
      const count = p < 2 ? 200 : 4;
      for (let i = 0; i < count; i++) {
        await ev.createEligibility({ evaluationId: evaluations[p].id, studentId: historical[i].id });
        const submission = await db.manager.save(t.Submission, { evaluation: { id: evaluations[p].id } });
        const answers = payload(questions).answers.filter(a => a.questionId !== questions[18].id || (p === 0 && i < 2) || p === 2);
        await db.manager.save(t.Answer, answers.map(a => ({ submission, question: { id: a.questionId }, scaleValue: a.scaleValue ?? null, choiceValue: a.choiceValue ?? null, textValue: a.textValue ?? null })));
        await db.getRepository(t.Eligibility).update({ evaluation: { id: evaluations[p].id }, student: { id: historical[i].id } }, { completed: true });
      }
    }
    save(path.join(state.workspace, 'common-private.json'), { admin, coordinator, professor, outsider, historicalStudent: historical[0],
      classes: classes.map(c => c.id), courseId: course.id, disciplineId: discipline.id, questionnaireId: questionnaire.id,
      questions, periods, closedEvaluations: evaluations.map(e => e.id) });
  });
}

export async function seedCohort(state, number, repetition, series = '') {
  await preflight(state);
  const p = allocation(number, repetition, series), dir = path.join(state.workspace, p.cohort);
  if (fs.existsSync(dir)) throw new Error('LOAD_COHORT_ALREADY_EXISTS_USE_NEW_REPETITION');
  fs.mkdirSync(dir);
  const common = JSON.parse(fs.readFileSync(path.join(state.workspace, 'common-private.json'), 'utf8'));
  let manifest;
  await services(state, async (app) => {
    const t = types(), users = app.get(t.Users), ev = app.get(t.Evaluations);
    const now = Date.now();
    const period = await ev.createPeriod({ name: p.cohort, startDate: new Date(now - 60000).toISOString(), endDate: new Date(now + 24 * 3600000).toISOString() });
    const evaluations = [];
    for (const classId of common.classes) evaluations.push(await ev.createEvaluation({ evaluationPeriodId: period.id, classGroupId: classId, questionnaireId: common.questionnaireId, minResponsesForResults: 5 }));
    const students = [];
    for (let i = 0; i < p.accounts; i++) {
      const user = await account(users, p.cohort + '-aluno' + i + '@carga.example.test', 'STUDENT');
      const evaluationId = evaluations[i % evaluations.length].id;
      await ev.createEligibility({ evaluationId, studentId: user.id });
      // O gerador HTTP não recebe IDs de estudantes, IDs de submissão ou credenciais do banco.
      students.push({ email: user.email, password: user.password, evaluationId });
    }
    manifest = { kind: 'UNIXS_LOAD_MANIFEST_V1', api: API, cohort: p.cohort, scenario: p.number, repetition,
      plan: p, students, questions: common.questions, periodId: period.id, evaluationIds: evaluations.map(e => e.id),
      resultId: common.closedEvaluations[0], comparisonQuery: '?periodId=' + common.periods[0] + '&comparisonPeriodId=' + common.periods[1],
      managers: [common.coordinator, common.admin].map(({ email, password }) => ({ email, password })) };
    assert.equal(students.length, p.accounts);
    save(path.join(dir, 'manifest-private.json'), manifest);
  });
  const client = await connect(state);
  try {
    const baseline = (await client.query('SELECT count(*)::int AS count FROM submissions WHERE evaluation_id = ANY($1::uuid[])', [manifest.evaluationIds])).rows[0].count;
    assert.equal(baseline, 0);
    save(path.join(dir, 'baseline.json'), { submissions: 0, answers: 0, completed: 0, accounts: p.accounts });
  } finally { await client.end(); }
  return { manifest, dir };
}
