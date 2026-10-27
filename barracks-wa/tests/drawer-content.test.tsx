import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";
import { DetailDrawer } from "../app/components/operations/OperationalPrimitives";

const dom = new JSDOM("<!doctype html><div id=root></div>");
const document = dom.window.document;
(globalThis as never as { document: unknown }).document = document;
(globalThis as never as { window: unknown }).window = dom.window;
(globalThis as never as { Event: unknown }).Event = dom.window.Event;
(globalThis as never as { HTMLElement: unknown }).HTMLElement = dom.window.HTMLElement;
(globalThis as never as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function installFakeEnvironment() {
  let nextFrameId = 1;
  const pendingFrames = new Map<number, () => void>();
  const sandbox = {
    requestAnimationFrame: (run: () => void) => {
      const id = nextFrameId++;
      pendingFrames.set(id, run);
      return id;
    },
    cancelAnimationFrame: (id: number) => pendingFrames.delete(id),
  };
  const saved = new Map<Record<string, unknown>, Map<string, unknown>>();
  const globalTarget = globalThis as Record<string, unknown>;
  const windowTarget = (globalThis as unknown as { window: Record<string, unknown> }).window;
  const frameTargets = [globalTarget, windowTarget];
  for (const target of frameTargets) {
    const previous = new Map<string, unknown>();
    for (const name of ["requestAnimationFrame", "cancelAnimationFrame"] as const) {
      const value = sandbox[name];
      previous.set(name, target[name]);
      target[name] = value;
    }
    saved.set(target, previous);
  }
  return {
    flushFrames() {
      const frames = [...pendingFrames.values()];
      pendingFrames.clear();
      for (const frame of frames) frame();
    },
    restore() {
      for (const [target, previous] of saved) {
        for (const [name, value] of previous) target[name] = value;
      }
    },
  };
}

function Harness() {
  const [open, setOpen] = useState(true);
  return <>
    <button type="button" onClick={() => setOpen(false)}>close</button>
    <DetailDrawer open={open} title={open ? "Customer details" : "Record detail"} onClose={() => setOpen(false)}>
      {open ? <p>Customer body</p> : null}
    </DetailDrawer>
  </>;
}

test("a detail drawer keeps its populated content during the first close render", async () => {
  const env = installFakeEnvironment();
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(Harness)));
    await act(async () => env.flushFrames());

    await act(async () => (container.querySelector("button") as HTMLElement).click());

    assert.match(container.textContent ?? "", /Customer details/);
    assert.match(container.textContent ?? "", /Customer body/);
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});
