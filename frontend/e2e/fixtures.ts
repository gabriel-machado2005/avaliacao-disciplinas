import { test as base, expect, type Page } from "@playwright/test";

export type Role = "ADMIN" | "COORDINATOR" | "PROFESSOR" | "STUDENT";
export const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export const discipline = {
  id: id(1),
  code: "DISC-FICTICIA",
  name: "Organização e desenvolvimento de sistemas de informação — disciplina fictícia para validação visual",
};
const professor = { id: id(2), name: "Docente fictício", role: "PROFESSOR" };
const course = {
  id: id(3),
  code: "CC",
  name: "Ciência da Computação — curso fictício",
};
export const periods = [
  {
    id: id(4),
    name: "Período fictício atual — avaliação de disciplinas",
    active: true,
    startDate: "2020-01-01T00:00:00Z",
    endDate: "2099-01-01T00:00:00Z",
  },
  {
    id: id(5),
    name: "Período fictício encerrado — referência histórica",
    active: true,
    startDate: "2020-01-01T00:00:00Z",
    endDate: "2020-06-01T00:00:00Z",
  },
  {
    id: id(6),
    name: "Período fictício anterior",
    active: true,
    startDate: "2019-01-01T00:00:00Z",
    endDate: "2019-06-01T00:00:00Z",
  },
  {
    id: id(7),
    name: "Período fictício futuro",
    active: true,
    startDate: "2099-01-01T00:00:00Z",
    endDate: "2099-06-01T00:00:00Z",
  },
  {
    id: id(8),
    name: "Período fictício inativo",
    active: false,
    startDate: "2020-01-01T00:00:00Z",
    endDate: "2099-01-01T00:00:00Z",
  },
];
const term = {
  id: id(9),
  code: "2026/2-FICTICIO",
  startDate: "2026-07-01",
  endDate: "2026-12-31",
};
const group = {
  id: id(10),
  code: "TURMA-FICTICIA-01",
  discipline: { ...discipline, course },
  professor,
  academicTerm: term,
};
export const questions = [
  {
    id: id(11),
    text: "Como você avalia a organização das atividades e dos materiais da disciplina?",
    type: "SCALE",
    required: true,
    scaleMin: 1,
    scaleMax: 5,
    options: null,
  },
  {
    id: id(12),
    text: "Qual alternativa descreve melhor sua experiência?",
    type: "SINGLE_CHOICE",
    required: true,
    scaleMin: null,
    scaleMax: null,
    options: [
      "Experiência satisfatória com atividades claras",
      "Experiência que precisa de melhorias",
    ],
  },
  {
    id: id(13),
    text: "Descreva uma sugestão de melhoria",
    type: "TEXT",
    required: true,
    scaleMin: null,
    scaleMax: null,
    options: null,
  },
  {
    id: id(14),
    text: "Observação adicional",
    type: "TEXT",
    required: false,
    scaleMin: null,
    scaleMax: null,
    options: null,
  },
];
const dimension = {
  id: id(15),
  name: "Organização e aprendizagem",
  description: "Dimensão fictícia",
  order: 1,
  questions,
};
const questionnaire = {
  id: id(16),
  name: "Questionário fictício de avaliação",
  active: true,
  description: "Apenas dados fictícios",
  dimensions: [dimension],
};
const evaluations = [periods[0], periods[1], periods[3], periods[4]].map(
  (period, i) => ({
    id: id(20 + i),
    evaluationPeriod: period,
    classGroup: group,
    questionnaire,
    minResponsesForResults: 3,
  }),
);
const metric = {
  questionId: questions[0].id,
  text: questions[0].text,
  dimensionId: dimension.id,
  dimensionName: dimension.name,
  questionnaireName: questionnaire.name,
  scaleMin: 1,
  scaleMax: 5,
  periods: [
    { periodId: periods[1].id, responses: 12, average: 4.5 },
    { periodId: periods[2].id, responses: 10, average: 3.5 },
  ],
};
const result = {
  evaluation: { discipline, classGroup: group.code, academicTerm: term.code },
  participation: { eligible: 15, responses: 12, rate: 80 },
  dimensions: [
    {
      ...dimension,
      questions: [
        {
          ...questions[0],
          status: "AVAILABLE",
          responses: 12,
          average: 4.5,
          distribution: { "4": 6, "5": 6 },
        },
        {
          ...questions[1],
          status: "AVAILABLE",
          responses: 12,
          distribution: {
            "Experiência satisfatória com atividades claras": 10,
            "Experiência que precisa de melhorias": 2,
          },
        },
        { ...questions[2], status: "COMMENTS_PROTECTED", responses: 12 },
        {
          id: id(17),
          text: "Pergunta opcional com métricas protegidas",
          type: "SCALE",
          status: "PROTECTED",
        },
        { ...questions[3], status: "NO_RESPONSES" },
      ],
    },
  ],
};
const plan = {
  id: id(30),
  discipline,
  problem:
    "Dificuldade fictícia de acompanhamento das atividades ao longo do período.",
  action:
    "Reorganizar o cronograma e disponibilizar materiais de apoio com antecedência.",
  assignee: professor,
  dueDate: "2027-02-01",
  status: "PENDING",
  createdAt: "2026-11-01T12:00:00Z",
  originPeriod: periods[2],
  originEvaluation: null,
};
const history = [
  {
    id: 1,
    previousStatus: null,
    status: "PENDING",
    changedAt: "2026-11-01T12:00:00Z",
    author: { name: "Coordenação fictícia" },
  },
];

export class MockApi {
  delayMs = 0;
  role: Role = "STUDENT";
  mode: "normal" | "empty" | "error" | "protected" = "normal";
  submitted = false;
  unknown: string[] = [];
  blocked: string[] = [];
  expectBlocked = false;
  savedPeriod: string | null = null;
  status = "PENDING";

  response(
    method: string,
    url: URL,
    body: Record<string, unknown>,
  ): { status?: number; data: unknown } | null {
    const route = url.pathname;
    if (method === "POST" && route === "/auth/login")
      return {
        status: 201,
        data: {
          accessToken: "token-ficticio-sem-validade",
          user: { name: "Pessoa fictícia", role: this.role },
        },
      };
    if (method === "GET" && route === "/evaluations/my") {
      if (this.mode === "error")
        return { status: 503, data: { message: "Falha fictícia de conexão" } };
      return {
        data:
          this.mode === "empty"
            ? []
            : evaluations.map((evaluation, i) => ({
                id: id(40 + i),
                completed: i === 0 && this.submitted,
                evaluation,
              })),
      };
    }
    if (method === "GET" && route === "/evaluations/professor/my")
      return { data: evaluations };
    if (method === "GET" && route === `/evaluations/${id(20)}/questionnaire`)
      return { data: { evaluationId: id(20), questionnaire } };
    if (method === "POST" && route === `/evaluations/${id(20)}/submissions`) {
      this.submitted = true;
      return {
        status: 201,
        data: {
          submissionId: id(50),
          answersCount: (body.answers as unknown[]).length,
        },
      };
    }
    if (
      method === "GET" &&
      evaluations.some((e) => route === `/evaluations/${e.id}/results`)
    )
      return this.mode === "protected"
        ? {
            status: 400,
            data: {
              message:
                "Resultados indisponíveis: período aberto ou mínimo não atingido.",
            },
          }
        : { data: result };
    if (method === "GET" && route === "/evaluations/periods")
      return { data: periods };
    if (method === "GET" && route === "/evaluations")
      return { data: evaluations };
    if (method === "GET" && route === "/academic/courses")
      return { data: [course] };
    if (method === "GET" && route === "/academic/disciplines")
      return { data: [{ ...discipline, course }] };
    if (method === "GET" && route === "/academic/classes")
      return { data: [group] };
    if (method === "GET" && route === "/academic/terms")
      return { data: [term] };
    if (method === "GET" && route === "/users/professors")
      return { data: [professor] };
    if (method === "GET" && route === "/users/students")
      return {
        data: [
          {
            id: id(60),
            name: "Estudante fictício",
            email: "estudante@example.test",
          },
        ],
      };
    if (method === "GET" && route === `/evaluations/${id(20)}/eligibilities`)
      return {
        data: [
          {
            id: id(61),
            student: {
              id: id(60),
              name: "Estudante fictício",
              email: "estudante@example.test",
            },
            completed: false,
            createdAt: "2026-11-01T12:00:00Z",
          },
        ],
      };
    if (method === "GET" && route === "/questionnaires")
      return { data: [questionnaire] };
    if (method === "GET" && route === `/questionnaires/${questionnaire.id}`)
      return { data: questionnaire };
    if (method === "GET" && route === "/improvement-plans")
      return {
        data: this.mode === "empty" ? [] : [{ ...plan, status: this.status }],
      };
    if (method === "GET" && route === "/improvement-plans/assignees")
      return { data: [professor] };
    if (method === "GET" && route === `/improvement-plans/${plan.id}`)
      return { data: { ...plan, status: this.status, history } };
    if (
      method === "PATCH" &&
      route === `/improvement-plans/${plan.id}/status`
    ) {
      this.status = String(body.status);
      return {
        data: {
          ...plan,
          status: this.status,
          history: [
            ...history,
            {
              id: 2,
              previousStatus: "PENDING",
              status: this.status,
              changedAt: "2026-11-20T12:00:00Z",
              author: { name: "Docente fictício" },
            },
          ],
        },
      };
    }
    if (
      ["GET", "PATCH"].includes(method) &&
      route === `/improvement-plans/${plan.id}/comparison`
    ) {
      if (method === "PATCH") this.savedPeriod = body.periodId as string | null;
      const selected = url.searchParams.get("periodId") ?? this.savedPeriod;
      return {
        data: {
          originPeriod: periods[2],
          followUpPeriod: selected ? periods[1] : null,
          savedPeriodId: this.savedPeriod,
          periods: [periods[1]],
          status: selected ? "AVAILABLE" : "SELECT_PERIOD",
          message: selected ? null : "Selecione um período posterior.",
          questions: selected ? [metric] : [],
        },
      };
    }
    if (method === "GET" && route === "/evaluations/analysis") {
      const selected = url.searchParams.get("periodId");
      const comparison = url.searchParams.get("comparisonPeriodId");
      const open = selected === periods[0].id;
      return {
        data: {
          periods: periods
            .filter((p) => p.id === selected || p.id === comparison)
            .map((p) => ({
              ...p,
              status: open ? "OPEN" : "AVAILABLE",
              participation: open
                ? null
                : { eligible: 15, responses: 12, rate: 80 },
              evaluations: open
                ? []
                : [
                    {
                      id: id(21),
                      classGroup: group.code,
                      discipline: discipline.name,
                      course: course.name,
                      academicTerm: term.code,
                      professor: professor.name,
                    },
                  ],
            })),
          filterOptions: {
            professors: [professor],
            dimensions: [
              { ...dimension, questionnaireName: questionnaire.name },
            ],
          },
          questions: open
            ? []
            : [
                {
                  ...metric,
                  periods: metric.periods.filter(
                    (p) => p.periodId === selected || p.periodId === comparison,
                  ),
                },
              ],
        },
      };
    }
    return null;
  }
}

export const test = base.extend<{ api: MockApi }>({
  api: async ({ page }, provide) => {
    const api = new MockApi();
    await page.routeWebSocket("**/*", (socket) => socket.close());
    await page.route("**/*", async (route) => {
      const request = route.request(),
        url = new URL(request.url());
      if (
        url.origin === "https://localhost:5174" &&
        request.method() === "GET" &&
        (url.pathname === "/" ||
          /^\/(src|node_modules|@vite|@react-refresh|@fs)\b/.test(
            url.pathname,
          ) ||
          url.pathname === "/favicon.svg")
      )
        return route.continue();
      if (url.origin === "https://api.unixs-ui.invalid") {
        if (api.delayMs)
          await new Promise((resolve) => setTimeout(resolve, api.delayMs));
        const response = api.response(
          request.method(),
          url,
          request.postDataJSON() ?? {},
        );
        if (response)
          return route.fulfill({
            status: response.status ?? 200,
            json: response.data,
          });
      }
      const label = `${request.method()} ${url.origin}${url.pathname}`;
      api.blocked.push(label);
      if (!api.expectBlocked) api.unknown.push(label);
      await route.abort("blockedbyclient");
    });
    await page.clock.setFixedTime(new Date("2026-11-20T12:00:00Z"));
    await provide(api);
    expect(api.unknown, "Requisições não previstas foram bloqueadas").toEqual(
      [],
    );
  },
});

export async function login(page: Page, api: MockApi, role: Role) {
  api.role = role;
  await page.goto("/");
  await page.getByLabel("E-mail", { exact: true }).fill("pessoa@example.test");
  await page
    .getByLabel("Senha", { exact: true })
    .fill("senha-ficticia-apenas-ui");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Olá, Pessoa fictícia!",
  );
}

export { expect };
