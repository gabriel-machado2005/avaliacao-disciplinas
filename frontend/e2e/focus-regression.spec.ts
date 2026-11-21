import { test, expect, id, type Role } from "./fixtures";
import AxeBuilder from "@axe-core/playwright";
import type { Page, TestInfo } from "@playwright/test";

const sections = [
  "evaluations",
  "analysis",
  "improvement-plans",
  "courses",
  "disciplines",
  "terms",
  "classes",
  "periods",
  "questionnaires",
  "eligibilities",
];

async function initialSession(page: Page, role: Role, section = "evaluations") {
  await page.addInitScript(
    ({ role, section }) => {
      // Sessão fictícia anterior à montagem, sem passar pelo login/transição interna.
      sessionStorage.setItem(
        "user",
        JSON.stringify({ name: "Pessoa fictícia", role }),
      );
      sessionStorage.setItem("accessToken", "token-ficticio-sem-validade");
      sessionStorage.setItem(`administrative-panel-section:${role}`, section);
      const focusEvents: string[] = [];
      Object.defineProperty(window, "__headingFocusEvents", {
        value: focusEvents,
      });
      document.addEventListener("focusin", (event) => {
        if (
          event.target instanceof HTMLElement &&
          /^H[1-6]$/.test(event.target.tagName)
        )
          focusEvents.push(event.target.textContent ?? "");
      });
    },
    { role, section },
  );
}

async function loaded(page: Page, role: Role, section: string) {
  if (role === "STUDENT")
    await expect(
      page.getByRole("button", { name: "Responder avaliação", exact: true }),
    ).toBeVisible();
  else if (role === "PROFESSOR")
    await expect(
      page.getByText("Situação: Em andamento", { exact: true }),
    ).toBeVisible();
  else if (section === "evaluations") {
    await expect(
      page.locator(`#evaluation-period option[value="${id(4)}"]`),
    ).toHaveCount(1);
    await expect(
      page.getByRole("button", { name: "Ver resultados", exact: true }).first(),
    ).toBeVisible();
  } else if (section === "analysis")
    await expect(
      page.getByRole("heading", { name: "Participação", exact: true }),
    ).toBeVisible();
  else if (section === "improvement-plans")
    await expect(
      page.getByRole("button", { name: "Ver plano", exact: true }),
    ).toBeVisible();
  else if (section === "eligibilities")
    await expect(
      page.locator(`#eligibility-evaluation option[value="${id(20)}"]`),
    ).toHaveCount(1);
  else
    await expect(
      page.getByRole("button", { name: "Editar", exact: true }).first(),
    ).toBeVisible();
  await expect(page.getByText(/^Carregando/)).toHaveCount(0);
}

async function noInitialFocus(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { __headingFocusEvents?: string[] })
          .__headingFocusEvents,
    ),
  ).toEqual([]);
  await expect(page.locator("body")).toBeFocused();
  await expect(
    page.locator(
      "h1[tabindex], h2[tabindex], h3[tabindex], h4[tabindex], h5[tabindex], h6[tabindex]",
    ),
  ).toHaveCount(0);
}

async function auditReload(page: Page, info: TestInfo) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "best-practice"])
    .analyze();
  await info.attach("recarga-axe", {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  expect(
    result.violations.map((v) => ({
      id: v.id,
      targets: v.nodes.map((n) => n.target),
    })),
  ).toEqual([]);
  await page.screenshot({
    path: info.outputPath("recarga-sem-foco.png"),
    fullPage: true,
  });
}

for (const role of ["ADMIN", "COORDINATOR"] as Role[])
  for (const section of sections) {
    test(`montagem e F5 ${role} ${section}`, async ({ page, api }, info) => {
      api.role = role;
      api.delayMs = 100; // Inclui dados chegando depois da montagem inicial.
      await initialSession(page, role, section);
      await page.goto("/");
      await loaded(page, role, section);
      await noInitialFocus(page);
      if (section === "evaluations" || section === "improvement-plans") {
        // F5 também deve limpar o foco que uma navegação anterior colocou no título.
        const navigation = page.getByRole("navigation", {
          name: "Navegação administrativa",
        });
        const target =
          section === "evaluations" ? /^Avaliações / : /^Planos de melhoria /;
        const other =
          section === "evaluations" ? /^Planos de melhoria / : /^Avaliações /;
        await navigation.getByRole("button", { name: other }).press("Enter");
        await expect(
          page.locator(".admin-panel-content h2").first(),
        ).toBeFocused();
        await navigation.getByRole("button", { name: target }).press("Enter");
        await loaded(page, role, section);
        await expect(
          page.locator(".admin-panel-content h2").first(),
        ).toBeFocused();
      }
      await page.reload();
      await loaded(page, role, section);
      await noInitialFocus(page);
      await auditReload(page, info);
    });
  }

for (const role of ["PROFESSOR", "STUDENT"] as Role[]) {
  test(`montagem e F5 ${role}, incluindo retorno após tela interna`, async ({
    page,
    api,
  }, info) => {
    api.role = role;
    api.delayMs = 100;
    await initialSession(page, role);
    await page.goto("/");
    await loaded(page, role, "evaluations");
    await noInitialFocus(page);
    await page.reload();
    await loaded(page, role, "evaluations");
    await noInitialFocus(page);
    if (role === "PROFESSOR") {
      await page
        .getByRole("button", { name: "Meus planos de melhoria", exact: true })
        .press("Enter");
      await expect(page.locator("#improvement-plans-heading")).toBeFocused();
      await expect(
        page.getByRole("button", { name: "Ver plano", exact: true }),
      ).toBeVisible();
    } else {
      await page
        .getByRole("button", { name: "Responder avaliação", exact: true })
        .press("Enter");
      await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
    }
    // Estas telas não são persistidas pelo aplicativo; F5 retorna à listagem.
    await page.reload();
    await loaded(page, role, "evaluations");
    await noInitialFocus(page);
    await auditReload(page, info);
  });
}
