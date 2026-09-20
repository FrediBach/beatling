import { useRef, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";

interface DragNumberOptions {
  value: number;
  onChange: (value: number) => void;
  sensitivity?: number;
}

export function useDragNumber({ value, onChange, sensitivity = 6 }: DragNumberOptions) {
  const state = useRef({ active: false, startY: 0, startValue: value });

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0) return;
      state.current = { active: true, startY: event.clientY, startValue: value };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.preventDefault();
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (!state.current.active) return;
      onChange(state.current.startValue + Math.round((state.current.startY - event.clientY) / sensitivity));
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      if (!state.current.active) return;
      state.current.active = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onPointerCancel(event: PointerEvent<HTMLElement>) {
      state.current.active = false;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    },
    onWheel(event: WheelEvent<HTMLElement>) {
      event.preventDefault();
      onChange(value + (event.deltaY < 0 ? 1 : -1));
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      let direction = 0;
      if (["ArrowUp", "ArrowRight"].includes(event.key)) direction = 1;
      if (["ArrowDown", "ArrowLeft"].includes(event.key)) direction = -1;
      if (!direction) return;
      event.preventDefault();
      onChange(value + direction * (event.shiftKey ? 4 : 1));
    },
  };
}
