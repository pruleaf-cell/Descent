import { useEffect, useRef, useState } from "react";
import type { LeaderboardEntry, PlayerProfile } from "@descent/shared";
import type { InputSnapshot, RuntimeBridge, RuntimeSnapshot } from "../game";
import { createEmptyInput, createGameRuntime } from "../game";

type UseGameRuntimeOptions = {
  profile?: PlayerProfile;
  leaderboard?: LeaderboardEntry[];
};

type RuntimeControls = {
  requestPointerLock(): void;
  releasePointerLock(): void;
  injectInput(next: Partial<InputSnapshot>): void;
};

type RuntimeHandle = {
  canvasRef: (node: HTMLCanvasElement | null) => void;
  state: RuntimeSnapshot | null;
  runtime: RuntimeBridge | null;
  controls: RuntimeControls;
};

export function useGameRuntime(options: UseGameRuntimeOptions = {}): RuntimeHandle {
  const [state, setState] = useState<RuntimeSnapshot | null>(null);
  const [runtime, setRuntime] = useState<RuntimeBridge | null>(null);
  const runtimeRef = useRef<RuntimeBridge | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    let alive = true;
    void createGameRuntime({ profile: options.profile, leaderboard: options.leaderboard }).then((runtime) => {
      if (!alive) {
        runtime.dispose();
        return;
      }
      runtimeRef.current = runtime;
      setRuntime(runtime);
      runtime.setProfile(options.profile);
      runtime.setLeaderboard(options.leaderboard ?? []);
      runtime.attachCanvas(canvasRef.current);
      setState(runtime.snapshot());
      intervalRef.current = window.setInterval(() => {
        runtime.step(1 / 60);
        setState(runtime.snapshot());
      }, 1000 / 60);
    });

    return () => {
      alive = false;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      runtimeRef.current?.dispose();
      runtimeRef.current = null;
      setRuntime(null);
    };
  }, [options.profile, options.leaderboard]);

  const canvasCallback = (node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    runtimeRef.current?.attachCanvas(node);
  };

  const injectInput = (next: Partial<InputSnapshot>) => {
    const current = { ...createEmptyInput(), ...next };
    runtimeRef.current?.setInput(current);
    setState(runtimeRef.current?.snapshot() ?? null);
  };

  return {
    canvasRef: canvasCallback,
    state,
    runtime,
    controls: {
      requestPointerLock() {
        canvasRef.current?.requestPointerLock();
      },
      releasePointerLock() {
        document.exitPointerLock();
      },
      injectInput
    }
  };
}
