import { useEffect, useMemo, useState } from "react";
import { createEmptyInput, InputController } from "../game";
import type { InputSnapshot } from "../game";

export function useGameInput(target: Window | HTMLElement | null = typeof window !== "undefined" ? window : null) {
  const [input, setInput] = useState<InputSnapshot>(createEmptyInput());
  const controller = useMemo(() => new InputController(), []);

  useEffect(() => {
    if (!target) return;
    controller.attach(target);
    const id = window.setInterval(() => setInput(controller.consume()), 16);
    return () => {
      window.clearInterval(id);
      controller.detach();
    };
  }, [controller, target]);

  return {
    input,
    controller
  };
}

