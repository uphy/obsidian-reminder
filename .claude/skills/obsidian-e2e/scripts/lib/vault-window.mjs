// Shared rules for finding the CDP page target that belongs to a given vault.
//
// Obsidian window titles come in two shapes, and only matching the first one
// (which is what this skill originally did) silently loses the window during
// the first seconds after a launch:
//
//   "<note title> - <vault> - Obsidian <version>"   once a note is open
//   "<vault> - Obsidian <version>"                  while no note is open yet
//
// The second form is what you see right after Obsidian starts, before the
// workspace has restored a note — exactly when a script polling for the window
// runs. The prefix form is anchored at the start of the title and immediately
// followed by " - Obsidian", so it is stricter, not looser, than the infix
// form: a note titled "notes" inside some other vault produces
// "notes - othervault - Obsidian ...", which does not match the prefix rule for
// vault "notes".
//
// Neither form is a permission check. See SKILL.md: the marker file is the only
// thing that expresses consent; these rules only decide *which already-approved
// vault's window* to talk to.

export const MARKER_RELATIVE_PATH = ".obsidian/obsidian-e2e-allowed";

export function titleMatchesVault(title, vault) {
  if (typeof title !== "string") {
    return false;
  }
  return title.includes(` - ${vault} - `) || title.startsWith(`${vault} - Obsidian`);
}

export function vaultPages(targets, vault) {
  return targets.filter((t) => t.type === "page" && titleMatchesVault(t.title, vault));
}

export function allPageTitles(targets) {
  return targets.filter((t) => t.type === "page").map((t) => t.title ?? "");
}

export async function fetchTargets(port) {
  const res = await fetch(`http://127.0.0.1:${port}/json/list`);
  return await res.json();
}

export function evaluateInPage(webSocketDebuggerUrl, expression, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(webSocketDebuggerUrl);
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("timed out waiting for CDP response"));
    }, timeoutMs);

    ws.addEventListener("open", () => {
      ws.send(
        JSON.stringify({
          id: 1,
          method: "Runtime.evaluate",
          params: {
            expression,
            awaitPromise: true,
            returnByValue: true,
          },
        }),
      );
    });

    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data.toString());
      } catch {
        return;
      }
      if (msg.id !== 1) return;
      clearTimeout(timeout);
      ws.close();

      if (msg.error) {
        reject(new Error(`CDP error: ${JSON.stringify(msg.error)}`));
        return;
      }
      const result = msg.result;
      if (result.exceptionDetails) {
        reject(
          new Error(
            result.exceptionDetails.exception?.description ||
              JSON.stringify(result.exceptionDetails),
          ),
        );
        return;
      }
      resolve(result.result?.value);
    });

    ws.addEventListener("error", (event) => {
      clearTimeout(timeout);
      reject(new Error(`WebSocket error: ${event.message || "unknown"}`));
    });
  });
}

/**
 * Wraps `code` so that, before any of it runs, the page re-reads its own vault
 * name and re-checks the marker file. See safety guard 4 in obsidian-eval.mjs.
 */
export function guardExpression(code, vault) {
  return `(async () => {
    const __vault = app.vault.getName();
    if (__vault !== ${JSON.stringify(vault)}) {
      throw new Error(
        "obsidian-e2e safety guard: expected vault " + ${JSON.stringify(vault)} +
        " but this page reports vault " + __vault
      );
    }
    const __allowed = await app.vault.adapter.exists(${JSON.stringify(MARKER_RELATIVE_PATH)});
    if (!__allowed) {
      throw new Error(
        "obsidian-e2e safety guard: marker file " + ${JSON.stringify(MARKER_RELATIVE_PATH)} +
        " not found in this vault. Refusing to run user code."
      );
    }
    return await (async () => {
${code}
    })();
  })()`;
}

/**
 * A fixed, read-only probe used to tell one of a vault's windows from another
 * once more than one is open. It runs through the same vault/marker guard as
 * user code, and only reads the DOM — it never writes anything.
 *
 * A page where the guard itself cannot run is not classified here at all: it
 * throws, and the caller records it as unusable. The settings window Obsidian
 * 1.13+ opens is exactly that case — its JS context has no `app` global, so
 * `app.vault.getName()` raises ReferenceError and there is no way to confirm
 * which vault that window belongs to. Nothing may be evaluated there. To see
 * the settings screen, screenshot it: obsidian-shot.sh --title-contains.
 */
export const WINDOW_KIND_PROBE = `
  const hasRootSplit = !!document.querySelector(".workspace-split.mod-root");
  const hasRibbon = !!document.querySelector(".workspace-ribbon");
  return {
    kind: (hasRibbon && hasRootSplit) ? "main" : "other",
    hasRootSplit, hasRibbon,
    title: document.title,
  };
`;
