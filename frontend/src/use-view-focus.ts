import { useEffect, useRef } from "react";

// Guarda uma chave do acionador, pois seu elemento pode ser desmontado na troca de tela.
export function useViewFocus(view: string, heading: string, ready = true) {
  // Montagem/F5 apenas estabelecem a tela inicial, inclusive nos componentes filhos.
  const previous = useRef(view);
  const pendingView = useRef<string | null>(null);
  const origins = useRef(new Map<string, string>());
  // O ref pertence à instância React: continua sendo o mesmo para os listeners
  // e para a rotina de foco quando o Vite substitui o módulo sem remontar a tela.
  const inputMode = useRef<"pointer" | "keyboard">("keyboard");

  useEffect(() => {
    function pointerInput() {
      inputMode.current = "pointer";
    }
    function keyboardInput(event: KeyboardEvent) {
      // Captura de tela e atalhos do sistema/navegador não são navegação da tela.
      if (
        event.altKey || event.ctrlKey || event.metaKey ||
        ["Shift", "Control", "Alt", "Meta", "PrintScreen"].includes(event.key) ||
        /^F(?:[1-9]|1\d|2[0-4])$/.test(event.key)
      ) return;
      inputMode.current = "keyboard";
      document.activeElement?.removeAttribute("data-view-focus-pointer");
    }
    document.addEventListener("pointerdown", pointerInput, true);
    document.addEventListener("keydown", keyboardInput, true);
    return () => {
      document.removeEventListener("pointerdown", pointerInput, true);
      document.removeEventListener("keydown", keyboardInput, true);
    };
  }, []);

  useEffect(() => {
    // A tela observada muda mesmo se seus dados ainda não chegaram ou se o
    // usuário voltar antes de seu título aparecer.
    if (previous.current !== view) {
      previous.current = view;
      pendingView.current = view;
    }
    if (!ready || pendingView.current !== view) return;
    const focus = () => {
      const id = origins.current.get(view);
      const origin = id
        ? document.querySelector<HTMLElement>(
            `[data-focus-id="${CSS.escape(id)}"]`,
          )
        : null;
      const target =
        (origin && !origin.matches(":disabled") ? origin : null) ??
        document.querySelector<HTMLElement>(heading);
      if (!target) return false;
      if (/^H[1-6]$/.test(target.tagName)) {
        target.tabIndex = -1;
        // O destino continua acessível; apenas sua indicação visual acompanha
        // a modalidade real, sem depender da heurística herdada dos inputs.
        target.toggleAttribute(
          "data-view-focus-pointer",
          inputMode.current === "pointer",
        );
        target.addEventListener(
          "blur",
          () => target.removeAttribute("data-view-focus-pointer"),
          { once: true },
        );
      }
      target.focus();
      pendingView.current = null;
      return true;
    };
    if (focus()) return;
    // Uma navegação pode esperar dados antes de montar seu título/acionador.
    // A observação só existe após mudança de tela e é cancelada ao sair dela.
    const pending = new MutationObserver(() => {
      if (focus()) pending.disconnect();
    });
    pending.observe(document.body, { childList: true, subtree: true });
    return () => pending.disconnect();
  }, [view, heading, ready]);

  return (id: string) => origins.current.set(view, id);
}
