import { registerHooks } from "node:module";

// Node does not render CSS. Preserve module class names for DOM selectors.
registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith(".css")) return { format: "module", shortCircuit: true, source: "export default new Proxy({}, { get: (_, name) => String(name) });" };
    return nextLoad(url, context);
  },
});
