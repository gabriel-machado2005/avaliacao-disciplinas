import { test, expect } from "./fixtures";

test("substituição do módulo preserva a modalidade e o estilo de foco", async ({
  page,
}, info) => {
  await page.goto("/");
  const main = await (await page.request.get("/src/main.tsx")).text();
  const hook = await (await page.request.get("/src/use-view-focus.ts")).text();
  const reactURL = hook.match(/from\s+["']([^"']*\/react\.js[^"']*)["']/)?.[1];
  const domURL = main.match(/from\s+["']([^"']*\/react-dom_client\.js[^"']*)["']/)?.[1];
  expect(reactURL).toBeTruthy();
  expect(domURL).toBeTruthy();

  // Troca a implementação mantendo a instância React e seus efeitos/ref,
  // como no Fast Refresh. Não altera arquivos nem depende de WebSockets.
  await page.evaluate(async ({ reactURL, domURL }) => {
    const reactModule = await import(reactURL!);
    const React = reactModule.default ?? reactModule;
    const domModule = await import(domURL!);
    const { createRoot } = domModule.default ?? domModule;
    const stamp = Date.now();
    let currentHook = (await import(`/src/use-view-focus.ts?initial=${stamp}`)).useViewFocus;
    const container = document.createElement("div");
    document.querySelector("main")!.append(container);
    const root = createRoot(container);
    function Harness() {
      const [view, setView] = React.useState("first");
      currentHook(view, "#hmr-heading");
      return React.createElement("section", { className: "ui-card" },
        React.createElement("h2", { id: "hmr-heading" }, `Tela fictícia: ${view}`),
        React.createElement("button", {
          className: "ui-btn",
          onClick: () => setView((previous: string) => previous === "first" ? "second" : "first"),
        }, "Alternar tela de teste"),
      );
    }
    root.render(React.createElement(Harness));
    (window as Window & { replaceFocusHook?: () => Promise<void> }).replaceFocusHook = async () => {
      currentHook = (await import(`/src/use-view-focus.ts?replacement=${stamp}`)).useViewFocus;
      root.render(React.createElement(Harness));
    };
  }, { reactURL, domURL });

  const trigger = page.getByRole("button", { name: "Alternar tela de teste" });
  const heading = page.locator("#hmr-heading");
  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(heading).toBeFocused();
  await expect(heading).toHaveCSS("outline-style", "none");
  await page.evaluate(() => (window as Window & { replaceFocusHook?: () => Promise<void> }).replaceFocusHook!());
  await trigger.click();
  await expect(heading).toBeFocused();

  // Exercita a heurística mais exigente do navegador: a exceção de ponteiro
  // precisa funcionar mesmo quando o título corresponde a :focus-visible.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("DOM.enable");
  await cdp.send("CSS.enable");
  const { root } = await cdp.send("DOM.getDocument");
  const { nodeId } = await cdp.send("DOM.querySelector", { nodeId: root.nodeId, selector: "#hmr-heading" });
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: ["focus-visible"] });
  const style = await heading.evaluate((element) => {
    const css = getComputedStyle(element);
    return { focus: element.matches(":focus"), focusVisible: element.matches(":focus-visible"), outlineStyle: css.outlineStyle, outline: css.outline, border: css.border, boxShadow: css.boxShadow };
  });
  await info.attach("estilo-apos-substituicao", { body: JSON.stringify(style, null, 2), contentType: "application/json" });
  expect(style).toMatchObject({ focus: true, focusVisible: true, outlineStyle: "none", boxShadow: "none" });
  await cdp.send("CSS.forcePseudoState", { nodeId, forcedPseudoClasses: [] });
  await page.keyboard.press("Tab");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("outline-style", "solid");
  await page.keyboard.press("Enter");
  await expect(heading).toBeFocused();
  await expect(heading).toHaveCSS("outline-style", "solid");
});
