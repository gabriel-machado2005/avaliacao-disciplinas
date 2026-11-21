import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Role } from "./fixtures";
import type { Page } from "@playwright/test";

async function renderedFocus(page: Page) {
  return page.locator("main h1").evaluate((element) => {
    const css = getComputedStyle(element);
    return {
      activeElement: document.activeElement?.tagName,
      focused: element.matches(":focus"),
      focusVisible: element.matches(":focus-visible"),
      pointer: element.hasAttribute("data-view-focus-pointer"),
      outline: css.outline,
      outlineStyle: css.outlineStyle,
      outlineWidth: css.outlineWidth,
      outlineColor: css.outlineColor,
      border: css.border,
      borderWidths: [css.borderTopWidth, css.borderRightWidth, css.borderBottomWidth, css.borderLeftWidth],
      boxShadow: css.boxShadow,
    };
  });
}

for (const role of ["ADMIN", "COORDINATOR", "PROFESSOR", "STUDENT"] as Role[]) {
  for (const mode of ["mouse", "keyboard"] as const) {
    test(`${role}: login e logout por ${mode} preservam foco e indicação apropriada`, async ({
      page,
      api,
    }, info) => {
      api.role = role;
      api.delayMs = 100;
      await page.goto("/");
      const heading = page.getByRole("heading", { level: 1 });
      const email = page.getByLabel("E-mail", { exact: true });
      const password = page.getByLabel("Senha", { exact: true });
      const enter = page.getByRole("button", { name: "Entrar", exact: true });
      await expect(heading).not.toBeFocused();

      if (mode === "mouse") {
        // Reproduz o preenchimento de inputs antes do clique, que pode fazer
        // o navegador herdar :focus-visible no destino programático.
        await email.click();
        await page.keyboard.type("pessoa@example.test");
        await password.click();
        await page.keyboard.type("senha-ficticia-apenas-ui");
        const box = await enter.boundingBox();
        expect(box).not.toBeNull();
        await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
      } else {
        await page.keyboard.press("Tab");
        await expect(email).toBeFocused();
        await page.keyboard.type("pessoa@example.test");
        await page.keyboard.press("Tab");
        await expect(password).toBeFocused();
        await page.keyboard.type("senha-ficticia-apenas-ui");
        await page.keyboard.press("Tab");
        await expect(enter).toBeFocused();
        await page.keyboard.press("Enter");
      }

      await expect(heading).toHaveText("Olá, Pessoa fictícia!");
      await expect(heading).toBeFocused();
      await expect(heading).toHaveCSS("outline-style", mode === "mouse" ? "none" : "solid");
      const natural = await renderedFocus(page);
      await info.attach("login-estilo-natural", { body: JSON.stringify(natural, null, 2), contentType: "application/json" });
      await page.screenshot({ path: info.outputPath(`${role}-${mode}-login.png`), fullPage: true });
      if (mode === "mouse") {
        expect(natural).toMatchObject({ focused: true, outlineStyle: "none", borderWidths: ["0px", "0px", "0px", "0px"], boxShadow: "none" });
        // Garante que a regra CSS de ponteiro prevalece mesmo se o navegador
        // atribuir :focus-visible ao título, como pode acontecer após inputs.
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("DOM.enable");
        await cdp.send("CSS.enable");
        const { root } = await cdp.send("DOM.getDocument");
        const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "main h1" });
        await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["focus-visible"] });
        for (const shortcut of ["PrintScreen", "Alt+Tab", "Control+Shift+I"]) {
          await page.keyboard.press(shortcut);
          const style = await renderedFocus(page);
          await info.attach(`login-estilo-${shortcut}`, { body: JSON.stringify(style, null, 2), contentType: "application/json" });
          expect(style).toMatchObject({ focused: true, focusVisible: true, outlineStyle: "none", borderWidths: ["0px", "0px", "0px", "0px"], boxShadow: "none" });
        }
        await page.screenshot({ path: info.outputPath(`${role}-mouse-focus-visible.png`), fullPage: true });
        await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
        // Retomar o teclado no mesmo título restaura imediatamente o indicador.
        await page.keyboard.press("ArrowDown");
        await expect(heading).toBeFocused();
        await expect(heading).toHaveCSS("outline-style", "solid");
      }
      const dashboard = await new AxeBuilder({ page }).analyze();
      await info.attach("autenticado-axe", {
        body: JSON.stringify(dashboard),
        contentType: "application/json",
      });
      expect(dashboard.violations).toEqual([]);

      const logout = page.getByRole("button", { name: "Sair", exact: true });
      if (mode === "mouse") await logout.click();
      else await logout.press("Enter");
      await expect(heading).toHaveText("Avaliação de Disciplinas");
      await expect(heading).toBeFocused();
      await expect(heading).toHaveCSS("outline-style", mode === "mouse" ? "none" : "solid");
      const login = await new AxeBuilder({ page }).analyze();
      await info.attach("logout-axe", {
        body: JSON.stringify(login),
        contentType: "application/json",
      });
      expect(login.violations).toEqual([]);
      await page.keyboard.press("Tab");
      await expect(email).toBeFocused();
      await expect(email).toHaveCSS("outline-style", "solid");
      await expect(heading).not.toHaveAttribute("data-view-focus-pointer");
    });
  }
}
