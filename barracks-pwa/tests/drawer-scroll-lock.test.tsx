import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { DetailDrawer } from "../app/components/operations/OperationalPrimitives";

const dom = new JSDOM("<!doctype html><body><div id=root></div></body>");
const document = dom.window.document;
(globalThis as never as { document: unknown }).document = document;
(globalThis as never as { window: unknown }).window = dom.window;
(globalThis as never as { HTMLElement: unknown }).HTMLElement = dom.window.HTMLElement;
(globalThis as never as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Frame = { id: number; run: () => void };

function installFakeEnvironment() {
  let nextFrameId = 1;
  let now = 0;
  const pendingFrames: Frame[] = [];
  const pendingTimeouts = new Map<number, { due: number; run: () => void }>();
  const sandbox = {
    requestAnimationFrame: (run: () => void) => {
      const id = nextFrameId++;
      pendingFrames.push({ id, run });
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      const index = pendingFrames.findIndex((frame) => frame.id === id);
      if (index >= 0) pendingFrames.splice(index, 1);
    },
    setTimeout: (run: () => void, delay: number) => {
      const id = -nextFrameId++;
      pendingTimeouts.set(id, { due: now + delay, run });
      return id;
    },
    clearTimeout: (id: number) => pendingTimeouts.delete(id),
  };
  const saved = new Map<Record<string, unknown>, Map<string, unknown>>();
  const targets = [globalThis as Record<string, unknown>, (globalThis as unknown as { window: Record<string, unknown> }).window];
  for (const target of targets) {
    const previous = new Map<string, unknown>();
    for (const [name, value] of Object.entries(sandbox)) {
      previous.set(name, target[name]);
      target[name] = value;
    }
    saved.set(target, previous);
  }
  return {
    flushFrames() {
      const frames = pendingFrames.splice(0, pendingFrames.length);
      for (const frame of frames) frame.run();
    },
    advance(delta: number) {
      now += delta;
      const due = [...pendingTimeouts.entries()].filter(([, timer]) => timer.due <= now);
      for (const [id] of due) pendingTimeouts.delete(id);
      for (const [, timer] of due) timer.run();
    },
    restore() {
      for (const [target, previous] of saved) {
        for (const [name, value] of previous) target[name] = value;
      }
    },
  };
}

function Harness() {
  const [active, setActive] = useState<"profile" | "request">("profile");
  return (
    <>
      <button id="switch" type="button" onClick={() => setActive("request")}>switch</button>
      <DetailDrawer open={active === "profile"} title="Supplier profile" onClose={() => setActive("request")}>
        <p>Profile body</p>
      </DetailDrawer>
      <DetailDrawer open={active === "request"} title="Restock request" onClose={() => setActive("profile")}>
        <p>Request body</p>
      </DetailDrawer>
    </>
  );
}

test("switching drawers keeps page scroll locked until the replacement closes", async () => {
  const env = installFakeEnvironment();
  const container = document.createElement("div");
  const root = createRoot(container);
  document.body.style.overflow = "";
  try {
    await act(async () => root.render(createElement(Harness)));
    await act(async () => env.flushFrames());
    await act(async () => env.flushFrames());
    assert.equal(document.body.style.overflow, "hidden");

    await act(async () => (container.querySelector("#switch") as HTMLButtonElement).click());
    await act(async () => env.advance(0));
    await act(async () => env.flushFrames());
    await act(async () => env.flushFrames());
    await act(async () => env.advance(330));

    assert.equal(document.body.style.overflow, "hidden");
  } finally {
    await act(async () => root.unmount());
    document.body.style.overflow = "";
    env.restore();
  }
});
