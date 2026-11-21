import AxeBuilder from "@axe-core/playwright";
import { test, expect, login, id, type Role } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";

async function audit(page: Page, info: TestInfo, name: string) {
  await expect(page.locator("html")).toHaveAttribute("lang", "pt-BR");
  const layout = await page.evaluate(() => {
    const visible = [
      ...document.querySelectorAll<HTMLElement>(
        "input, select, textarea, button, .ui-status, .results-distribution__row",
      ),
    ].filter((e) => e.getClientRects().length);
    return {
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      outside: visible
        .filter((e) => {
          const r = e.getBoundingClientRect();
          const card = e
            .closest(".evaluation-card, .login-card")
            ?.getBoundingClientRect();
          return (
            r.left < -1 ||
            r.right > innerWidth + 1 ||
            (card && (r.left < card.left - 1 || r.right > card.right + 1))
          );
        })
        .map(
          (e) => `${e.tagName} ${e.id || e.textContent?.trim().slice(0, 90)}`,
        ),
    };
  });
  expect(
    layout,
    "Nenhum controle ou indicador deve transbordar a página",
  ).toMatchObject({ outside: [] });
  expect(layout.scroll).toBeLessThanOrEqual(layout.width + 1);
  const accessibility = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  await info.attach(`${name}-axe`, {
    body: JSON.stringify(accessibility, null, 2),
    contentType: "application/json",
  });
  expect(
    accessibility.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      nodes: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  // Elementos que recebem o clique não podem estar encobertos por outros controles.
  for (const button of await page.getByRole("button").all())
    if (await button.isEnabled()) await button.click({ trial: true });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: info.outputPath(`${name}.png`),
    fullPage: true,
  });
}

test("login: identificação, teclado e foco visível", async ({
  page,
  api,
}, info) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Plataforma de Avaliação de Disciplinas");
  const heading = page.getByRole("heading", { level: 1 });
  // Aguarda o ciclo de pintura/efeitos para não aprovar antes do foco automático.
  const expectInitialFocus = async () => {
    await expect(heading).toHaveText("Avaliação de Disciplinas");
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
        }),
    );
    await expect(heading).not.toBeFocused();
    await expect(page.locator("body")).toBeFocused();
    await expect(heading).not.toHaveAttribute("tabindex");
  };
  await expectInitialFocus();
  await page.reload();
  await expectInitialFocus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("E-mail", { exact: true })).toBeFocused();
  await expect(page.getByLabel("E-mail", { exact: true })).toHaveCSS(
    "outline-style",
    "solid",
  );
  await page.keyboard.type("pessoa@example.test");
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Senha", { exact: true })).toBeFocused();
  await page.keyboard.type("senha-ficticia-apenas-ui");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("button", { name: "Entrar", exact: true }),
  ).toBeFocused();
  await audit(page, info, "login");
  api.role = "STUDENT";
  await page.getByRole("button", { name: "Entrar", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Olá, Pessoa fictícia!",
  );
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
  await expect(
    page.getByText("Situação: Disponível para responder", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).press("Enter");
  // Voltar ao login é uma transição interna, portanto continua recebendo foco.
  await expect(heading).toHaveText("Avaliação de Disciplinas");
  await expect(heading).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("E-mail", { exact: true })).toBeFocused();
});

for (const role of ["ADMIN", "COORDINATOR", "PROFESSOR", "STUDENT"] as Role[]) {
  test(`${role}: navegação, formulários, cartões e acessibilidade`, async ({
    page,
    api,
  }, info) => {
    await login(page, api, role);
    if (role === "STUDENT") {
      const respond = page.getByRole("button", {
        name: "Responder avaliação",
        exact: true,
      });
      await expect(respond).toBeVisible();
      await audit(page, info, "student-avaliacoes");
      await respond.focus();
      await page.keyboard.press("Enter");
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      await expect(
        page.getByLabel("Descreva uma sugestão de melhoria", { exact: false }),
      ).toHaveAttribute("placeholder", /obrigatório/);
      await expect(page.getByLabel("Observação adicional")).toHaveAttribute(
        "placeholder",
        /opcional/,
      );
      await audit(page, info, "student-questionario");
      await page.getByRole("button", { name: "Voltar às avaliações" }).click();
      await expect(respond).toBeFocused();
      await respond.press("Enter");
      await page.getByLabel(/Como você avalia/).selectOption("5");
      await page.getByLabel(/Qual alternativa/).selectOption({ index: 1 });
      await page
        .getByLabel(/Descreva uma sugestão/)
        .fill("Sugestão exclusivamente fictícia para o teste de interface.");
      await page
        .getByRole("button", { name: "Enviar avaliação", exact: true })
        .press("Enter");
      await expect(
        page.getByRole("heading", { level: 1, name: "Avaliação enviada!" }),
      ).toBeFocused();
      await audit(page, info, "student-enviada");
      await page.getByRole("button", { name: "Voltar às avaliações" }).click();
      await expect(
        page.getByText("Situação: Respondida", { exact: true }),
      ).toBeVisible();
      return;
    }
    if (role === "PROFESSOR") {
      await expect(
        page.getByText("Situação: Em andamento", { exact: true }),
      ).toBeVisible();
      for (const status of ["Encerrada", "Ainda não iniciada", "Inativa"])
        await expect(
          page.getByText(`Situação: ${status}`, { exact: true }),
        ).toBeVisible();
      await audit(page, info, "professor-avaliacoes");
      const results = page
        .getByRole("button", { name: "Ver resultados", exact: true })
        .nth(1);
      await results.press("Enter");
      await expect(
        page.getByRole("heading", { name: "Resultados da avaliação" }),
      ).toBeFocused();
      await expect(
        page.getByText("Comentários protegidos", { exact: true }),
      ).toBeVisible();
      await audit(page, info, "professor-resultados");
      await page
        .getByRole("button", { name: "Voltar para avaliações" })
        .click();
      await expect(results).toBeFocused();
      await page
        .getByRole("button", { name: "Meus planos de melhoria", exact: true })
        .press("Enter");
    } else {
      await expect(
        page.getByRole("heading", { name: "Gerenciamento de avaliações" }),
      ).toBeVisible();
      await audit(page, info, `${role}-avaliacoes`);
      await page
        .getByRole("button", { name: "Ocultar menu", exact: true })
        .press("Enter");
      await expect(
        page.getByRole("navigation", { name: "Navegação administrativa" }),
      ).toBeHidden();
      await page.keyboard.press("Tab");
      await expect(
        page.getByLabel("Período de avaliação", { exact: true }),
      ).toBeFocused();
      await page
        .getByRole("button", { name: "Mostrar menu", exact: true })
        .press("Enter");
      await page
        .getByRole("button", { name: "Ver resultados", exact: true })
        .nth(1)
        .press("Enter");
      await expect(
        page.getByRole("heading", { name: "Resultados da avaliação" }),
      ).toBeFocused();
      await audit(page, info, `${role}-resultados`);
      await page
        .getByRole("button", { name: "Voltar para avaliações" })
        .click();
      for (const name of [
        "Cursos",
        "Disciplinas",
        "Semestres",
        "Turmas",
        "Períodos",
        "Estudantes habilitados",
        "Questionários",
      ]) {
        await page
          .getByRole("button", { name: new RegExp(`^${name} `) })
          .press("Enter");
        await expect(
          page.locator(".admin-panel-content h2").first(),
        ).toBeFocused();
        await audit(page, info, `${role}-${name}`);
      }
      await page
        .getByRole("combobox", { name: "Questionário", exact: true })
        .selectOption(id(16));
      await page
        .getByRole("button", { name: "Gerenciar dimensões", exact: true })
        .click();
      await expect(
        page.getByRole("heading", { name: "Gerenciamento de dimensões" }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Gerenciar perguntas", exact: true })
        .click();
      await expect(page.getByLabel("Enunciado da pergunta")).toBeVisible();
      await audit(page, info, `${role}-dimensoes-perguntas`);
      await page
        .getByRole("button", { name: /^Análise de resultados / })
        .press("Enter");
      await page
        .getByLabel("Período de avaliação", { exact: true })
        .selectOption(id(5));
      await page
        .getByLabel("Comparar com", { exact: true })
        .selectOption(id(6));
      await expect(
        page.getByRole("heading", { name: "Comparação por dimensão" }),
      ).toBeVisible();
      await audit(page, info, `${role}-analise-historica`);
      await page
        .getByRole("button", { name: /^Planos de melhoria / })
        .press("Enter");
    }
    const viewPlan = page.getByRole("button", {
      name: "Ver plano",
      exact: true,
    });
    await expect(viewPlan).toBeVisible();
    await audit(page, info, `${role}-planos`);
    if (role !== "PROFESSOR") {
      const newPlan = page.getByRole("button", {
        name: "Novo plano",
        exact: true,
      });
      await newPlan.press("Enter");
      await expect(page.locator("#plan-editor-heading")).toBeFocused();
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(newPlan).toBeFocused();
    }
    await viewPlan.press("Enter");
    await expect(page.locator("#plan-detail-heading")).toBeFocused();
    await expect(
      page.getByRole("heading", { name: "Histórico de situações" }),
    ).toBeVisible();
    await audit(page, info, `${role}-plano-detalhes`);
    if (role === "PROFESSOR") {
      await expect(
        page.getByRole("button", { name: "Editar plano" }),
      ).toHaveCount(0);
      await page
        .getByLabel("Situação", { exact: true })
        .selectOption("IN_PROGRESS");
      await page
        .getByRole("button", { name: "Atualizar situação", exact: true })
        .press("Enter");
      await expect(
        page.getByText("Situação atualizada.", { exact: true }),
      ).toBeVisible();
    } else {
      await page.getByLabel("Período posterior").selectOption(id(5));
      await page
        .getByRole("button", { name: "Comparar resultados", exact: true })
        .press("Enter");
      await expect(
        page.getByRole("heading", { name: "Perguntas comparáveis" }),
      ).toBeVisible();
      await audit(page, info, `${role}-plano-comparacao`);
      await page
        .getByRole("button", { name: "Editar plano", exact: true })
        .press("Enter");
      await expect(page.getByLabel("Problema identificado")).toBeVisible();
      await expect(page.locator("#plan-editor-heading")).toBeFocused();
      await audit(page, info, `${role}-plano-edicao`);
      await page.getByRole("button", { name: "Cancelar", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "Editar plano", exact: true }),
      ).toBeFocused();
    }
    await page
      .getByRole("button", { name: "Voltar para planos", exact: true })
      .click();
    await expect(viewPlan).toBeFocused();
  });
}

test("estados vazio, erro e resultados protegidos", async ({
  page,
  api,
}, info) => {
  api.mode = "empty";
  await login(page, api, "STUDENT");
  await expect(
    page.getByText("Nenhuma avaliação encontrada para este estudante."),
  ).toBeVisible();
  await audit(page, info, "estado-vazio");
  api.mode = "error";
  await page.reload();
  await expect(page.getByRole("alert")).toHaveText(
    "Não foi possível carregar as avaliações.",
  );
  await audit(page, info, "estado-erro");
  api.mode = "protected";
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await login(page, api, "PROFESSOR");
  await page
    .getByRole("button", { name: "Ver resultados", exact: true })
    .first()
    .click();
  await expect(page.getByRole("alert")).toContainText(
    "Resultados indisponíveis",
  );
  await expect(
    page.getByRole("button", { name: "Exportar relatório (CSV)" }),
  ).toHaveCount(0);
  await audit(page, info, "estado-protegido");
});

test("bloqueia qualquer API ou destino não previsto antes da rede", async ({
  page,
  api,
}) => {
  await page.goto("/");
  api.expectBlocked = true;
  for (const url of [
    "https://api.unixs-ui.invalid/rota-nao-prevista",
    "https://localhost:3000/",
    "https://example.com/",
  ]) {
    expect(
      await page.evaluate(async (url) => {
        try {
          await fetch(url);
          return false;
        } catch {
          return true;
        }
      }, url),
    ).toBe(true);
  }
  expect(api.blocked).toHaveLength(3);
});
