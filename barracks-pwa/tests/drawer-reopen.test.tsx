import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useState } from "react";
import { createRoot } from "react-dom/client";
import { useDrawerPresence } from "../app/hooks/useDrawerPresence";

// The client renderer needs a DOM; provide one before React is exercised.
import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><div id=root></div>");
const document = dom.window.document;
(globalThis as never as { document: unknown }).document = document;
(globalThis as never as { window: unknown }).window = dom.window;
(globalThis as never as { Event: unknown }).Event = dom.window.Event;
// React's act() must know this is a test environment.
(globalThis as never as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Frame = { id: number; run: () => void };

function installFakeEnvironment() {
  let nextFrameId = 1;
  let now = 0;
  const pendingFrames: Frame[] = [];
  const pendingTimeouts = new Map<number, { due: number; run: () => void }>();
  const flushFrames = () => {
    const frames = pendingFrames.splice(0, pendingFrames.length);
    for (const frame of frames) frame.run();
  };
  const advance = (delta: number) => {
    now += delta;
    const due = [...pendingTimeouts.entries()].filter(([, timer]) => timer.due <= now);
    for (const [id] of due) pendingTimeouts.delete(id);
    for (const [, timer] of due) timer.run();
  };
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
    clearTimeout: (id: number) => {
      pendingTimeouts.delete(id);
    },
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
    flushFrames,
    advance,
    restore() {
      for (const [target, previous] of saved) {
        for (const [name, value] of previous) target[name] = value;
      }
    },
  };
}

function Harness({ onPresence }: { onPresence: (presence: { mounted: boolean; phase: string }) => void }) {
  const [open, setOpen] = useState(false);
  const presence = useDrawerPresence(open);
  onPresence(presence);
  return <button type="button" onClick={() => setOpen((current) => !current)}>toggle</button>;
}

test("reopening mid-exit reverses from the current position instead of retreating offscreen", async () => {
  const env = installFakeEnvironment();
  const seen: Array<{ mounted: boolean; phase: string }> = [];
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => {
      root.render(createElement(Harness, { onPresence: (presence) => seen.push({ ...presence }) }));
    });
    assert.equal(seen.at(-1)?.mounted, false);

    await act(async () => {
      (container.querySelector("button") as HTMLElement).click();
    });
    await act(async () => env.flushFrames());
    await act(async () => env.flushFrames());
    assert.equal(seen.at(-1)?.phase, "entered");

    await act(async () => {
      (container.querySelector("button") as HTMLElement).click();
    });
    await act(async () => env.advance(0));
    assert.equal(seen.at(-1)?.phase, "exiting");

    await act(async () => {
      (container.querySelector("button") as HTMLElement).click();
    });
    assert.equal(seen.at(-1)?.phase, "entered");

    assert.ok(!seen.slice(-2, -1).some((entry) => entry.phase === "entering" && entry.mounted),
      "a reopen must not route back through the fully offscreen entering position");
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});

test("a newly mounted closed drawer stays unmounted", async () => {
  const env = installFakeEnvironment();
  const seen: Array<{ mounted: boolean; phase: string }> = [];
  function ClosedHarness() {
    const presence = useDrawerPresence(false);
    seen.push({ ...presence });
    return null;
  }
  const container = document.createElement("div");
  const root = createRoot(container);
  try {
    await act(async () => root.render(createElement(ClosedHarness)));
    await act(async () => env.advance(0));

    assert.equal(seen.at(-1)?.mounted, false);
  } finally {
    await act(async () => root.unmount());
    env.restore();
  }
});
