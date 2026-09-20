import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatchCables } from "./patch-cables";
import type { Connection } from "@/lib/routing";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("patch cable interaction", () => {
  it("fades cables crossing an unrelated hovered or focused block, then restores them", () => {
    vi.useFakeTimers();
    const context = {
      globalAlpha: 1, setTransform: vi.fn(), clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      beginPath: vi.fn(), moveTo: vi.fn(), quadraticCurveTo: vi.fn(), lineTo: vi.fn(),
      stroke: vi.fn(), translate: vi.fn(), rotate: vi.fn(), roundRect: vi.fn(), fill: vi.fn(), fillRect: vi.fn(),
    };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const disconnect = vi.fn();
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect = disconnect; });
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      let x = 0, y = 0, width = 400, height = 250;
      if (this.dataset.cablePort === "out-Trigger") { x = 20; y = 20; width = height = 4; }
      if (this.dataset.cablePort === "in-Clock") { x = 360; y = 20; width = height = 4; }
      if (this.dataset.blockIndex === "2") { x = 100; width = 150; }
      return { x, y, width, height, left: x, top: y, right: x + width, bottom: y + height, toJSON() {} };
    });
    const connection: Connection = { source: 0, target: 1, input: "Clock", output: "Trigger" };
    function Fixture({ connections }: { connections: Connection[] }) {
      return <div>
        <article data-block-index="0"><i data-cable-port="out-Trigger" /></article>
        <article data-block-index="1"><i data-cable-port="in-Clock" /></article>
        <article data-block-index="2" data-testid="crossed-block"><button>Adjust steps</button></article>
        <PatchCables connections={connections} />
      </div>;
    }
    const { rerender, unmount } = render(<Fixture connections={[connection]} />);
    act(() => vi.advanceTimersByTime(400));
    expect(context.stroke).toHaveBeenCalled();
    const block = screen.getByTestId("crossed-block");
    fireEvent.pointerOver(block);
    act(() => vi.advanceTimersByTime(400));
    context.stroke.mockClear();
    act(() => vi.advanceTimersByTime(100));
    expect(context.stroke).not.toHaveBeenCalled();
    fireEvent.pointerOut(block, { relatedTarget: null });
    act(() => vi.advanceTimersByTime(400));
    expect(context.stroke).toHaveBeenCalled();
    fireEvent.focusIn(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(400));
    context.stroke.mockClear();
    act(() => vi.advanceTimersByTime(100));
    expect(context.stroke).not.toHaveBeenCalled();
    fireEvent.focusOut(screen.getByRole("button"));
    act(() => vi.advanceTimersByTime(400));
    expect(context.stroke).toHaveBeenCalled();
    rerender(<Fixture connections={[]} />);
    context.stroke.mockClear();
    act(() => vi.advanceTimersByTime(100));
    expect(context.stroke).not.toHaveBeenCalled();
    unmount();
    expect(disconnect).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
});
