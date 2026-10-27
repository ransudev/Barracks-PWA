import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useDrawerPresence } from "../app/hooks/useDrawerPresence";

function DrawerPresenceHarness({ open }: { open: boolean }) {
  const presence = useDrawerPresence(open);
  return createElement("div", {
    "data-mounted": String(presence.mounted),
    "data-state": presence.phase,
  });
}

test("a drawer mounted open publishes its entering state before settling", () => {
  const markup = renderToStaticMarkup(createElement(DrawerPresenceHarness, { open: true }));

  assert.match(markup, /data-mounted="true"/);
  assert.match(markup, /data-state="entering"/);
});

test("a drawer mounted closed stays unmounted", () => {
  const markup = renderToStaticMarkup(createElement(DrawerPresenceHarness, { open: false }));

  assert.match(markup, /data-mounted="false"/);
  assert.match(markup, /data-state="exiting"/);
});
