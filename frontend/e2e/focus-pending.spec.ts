import { test, expect, login, id, type Role } from "./fixtures";
import type { Page, Route } from "@playwright/test";

function signal() {
  let release = () => {};
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

// Retém uma resposta fictícia, sem sleeps e sem permitir acesso à API real.
async function holdResponses(page: Page, pathname: string) {
  const gate = signal(),
    entered = signal();
  const completions: Promise<void>[] = [];
  const url = `https://api.unixs-ui.invalid${pathname}`;
  const handler = async (route: Route) => {
    const completion = signal();
    completions.push(completion.promise);
    entered.release();
    try {
      await gate.promise;
      await route.fallback(); // Continua no mock estrito, nunca na rede.
    } finally {
      completion.release();
    }
  };
  // StrictMode pode montar o efeito duas vezes: ambas as respostas ficam retidas.
  await page.route(url, handler);
  return {
    entered: entered.promise,
    release: async () => {
      gate.release();
      await Promise.all(completions);
      await page.unroute(url, handler);
    },
  };
}

for (const role of ["ADMIN", "PROFESSOR"] as Role[]) {
  test(`${role}: voltar antes dos detalhes carregarem restaura o acionador`, async ({
    page,
    api,
  }) => {
    await login(page, api, role);
    await page
      .getByRole("button", {
        name:
          role === "ADMIN" ? /^Planos de melhoria / : "Meus planos de melhoria",
      })
      .press("Enter");
    const opener = page.getByRole("button", { name: "Ver plano", exact: true });
    await expect(opener).toBeVisible();
    const held = await holdResponses(page, `/improvement-plans/${id(30)}`);
    try {
      await opener.press("Enter");
      await held.entered;
      await expect(page.locator("#plan-detail-heading")).toHaveCount(0);
      await page
        .getByRole("button", { name: "Voltar para planos", exact: true })
        .press("Enter");
      await expect(opener).toBeFocused();
      const filter = page.getByLabel("Situação", { exact: true });
      await filter.focus();
      await held.release();
      await expect(filter).toBeFocused();
      await expect(page.locator("#plan-detail-heading")).toHaveCount(0);
    } finally {
      await held.release();
    }
  });
}

test("sair durante carregamento preserva foco e permite entrar com outro perfil", async ({
  page,
  api,
}) => {
  const held = await holdResponses(page, "/evaluations/my");
  try {
    await login(page, api, "STUDENT");
    await held.entered;
    await expect(
      page.getByText("Carregando avaliações...", { exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Sair", exact: true })
      .press("Enter");
    const heading = page.getByRole("heading", { level: 1 });
    await expect(heading).toHaveText("Avaliação de Disciplinas");
    await expect(heading).toBeFocused();
    await held.release();
    api.role = "PROFESSOR";
    await page
      .getByLabel("E-mail", { exact: true })
      .fill("docente@example.test");
    await page
      .getByLabel("Senha", { exact: true })
      .fill("senha-ficticia-apenas-ui");
    await page
      .getByRole("button", { name: "Entrar", exact: true })
      .press("Enter");
    await expect(
      page.getByText("Situação: Em andamento", { exact: true }),
    ).toBeVisible();
    await expect(heading).toHaveText("Olá, Pessoa fictícia!");
    await expect(heading).toBeFocused();
  } finally {
    await held.release();
  }
});
