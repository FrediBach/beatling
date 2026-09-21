import { act, cleanup, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { OutputSpectrum } from "./output-spectrum";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function setup() {
  let onResize: ResizeObserverCallback;
  let onIntersection: IntersectionObserverCallback;
  let onMotion: () => void;
  const resizeDisconnect = vi.fn();
  const intersectionDisconnect = vi.fn();
  vi.stubGlobal("ResizeObserver", class {
    constructor(callback: ResizeObserverCallback) { onResize = callback; }
    observe() {}
    disconnect = resizeDisconnect;
  });
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { onIntersection = callback; }
    observe() {}
    disconnect = intersectionDisconnect;
  });
  const motion = { matches: false, addEventListener: vi.fn((_type, callback) => { onMotion = callback; }), removeEventListener: vi.fn() };
  vi.stubGlobal("matchMedia", () => motion);
  const frames = new Map<number, FrameRequestCallback>();
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const context = { clearRect: vi.fn(), fillRect: vi.fn(), fillStyle: "", globalAlpha: 1 };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
  const analysis = { sampleRate: 48000, binCount: 512, read: vi.fn((data: Uint8Array) => data.fill(128)), disconnect: vi.fn() };
  const observeOutput = vi.fn(() => analysis);
  return {
    observeOutput, analysis, context, frames, resizeDisconnect, intersectionDisconnect, motion,
    resize: (width: number) => act(() => onResize([{ contentRect: { width, height: 44 } }] as ResizeObserverEntry[], {} as ResizeObserver)),
    intersect: (isIntersecting: boolean) => act(() => onIntersection([{ isIntersecting }] as IntersectionObserverEntry[], {} as IntersectionObserver)),
    reduceMotion: (value: boolean) => act(() => { motion.matches = value; onMotion(); }),
    tick: (time: number) => act(() => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach((callback) => callback(time)); }),
  };
}

it("only analyses visible playback with spare space, reuses samples, and caps drawing at 30 fps", () => {
  const test = setup();
  const { rerender, container } = render(<OutputSpectrum playing={false} observeOutput={test.observeOutput} />);
  expect(test.observeOutput).not.toHaveBeenCalled();
  expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  expect(container.firstChild).toHaveAttribute("data-playing", "false");
  rerender(<OutputSpectrum playing observeOutput={test.observeOutput} />);
  expect(container.firstChild).toHaveAttribute("data-playing", "true");
  test.resize(100);
  test.intersect(true);
  expect(test.observeOutput).not.toHaveBeenCalled();
  test.resize(240);
  expect(test.observeOutput).toHaveBeenCalledOnce();
  test.tick(0);
  test.tick(16);
  test.tick(34);
  expect(test.analysis.read).toHaveBeenCalledTimes(2);
  expect(test.analysis.read.mock.calls[0][0]).toBe(test.analysis.read.mock.calls[1][0]);
  expect(test.context.fillRect).toHaveBeenCalled();
  test.resize(80);
  expect(test.analysis.disconnect).toHaveBeenCalledOnce();
  expect(test.frames.size).toBe(0);
  test.resize(240);
  expect(test.observeOutput).toHaveBeenCalledTimes(2);
  test.tick(68);
  test.context.clearRect.mockClear();
  rerender(<OutputSpectrum playing={false} observeOutput={test.observeOutput} />);
  expect(container.firstChild).toHaveAttribute("data-playing", "false");
  // The last painted frame remains available for the CSS fade after drawing stops.
  expect(test.context.clearRect).not.toHaveBeenCalled();
  expect(test.analysis.disconnect).toHaveBeenCalledTimes(2);
  expect(test.frames.size).toBe(0);
  expect(test.resizeDisconnect).toHaveBeenCalledOnce();
  expect(test.intersectionDisconnect).toHaveBeenCalledOnce();
});

it("releases analysis offscreen, in hidden tabs, with reduced motion, and on unmount", () => {
  const test = setup();
  const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  const { unmount } = render(<OutputSpectrum playing observeOutput={test.observeOutput} />);
  test.resize(240);
  test.intersect(true);
  test.intersect(false);
  expect(test.analysis.disconnect).toHaveBeenCalledTimes(1);
  expect(test.frames.size).toBe(0);
  test.intersect(true);
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  expect(test.analysis.disconnect).toHaveBeenCalledTimes(2);
  expect(test.frames.size).toBe(0);
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  test.reduceMotion(true);
  expect(test.analysis.disconnect).toHaveBeenCalledTimes(3);
  expect(test.frames.size).toBe(0);
  test.reduceMotion(false);
  unmount();
  expect(test.analysis.disconnect).toHaveBeenCalledTimes(4);
  expect(test.frames.size).toBe(0);
  expect(test.motion.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
});
