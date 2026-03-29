import { defaultControls } from "@descent/shared";
import type { InputSnapshot } from "./contracts";

const emptyInput = (): InputSnapshot => ({
  thrustForward: false,
  thrustBackward: false,
  strafeLeft: false,
  strafeRight: false,
  rollLeft: false,
  rollRight: false,
  moveUp: false,
  moveDown: false,
  afterburner: false,
  flare: false,
  primaryFire: false,
  secondaryFire: false,
  nextWeapon: false,
  automap: false,
  pause: false,
  mouseDeltaX: 0,
  mouseDeltaY: 0
});

export class InputController {
  private readonly bindings = defaultControls;
  private state = emptyInput();
  private pointerLocked = false;
  private detachKeyboard?: () => void;
  private detachMouse?: () => void;

  get snapshot(): InputSnapshot {
    return { ...this.state };
  }

  get isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  attach(target: Window | HTMLElement): void {
    const onKeyDown = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;
      this.applyKeyState(event.code, true);
      if (event.code === this.bindings.flare) {
        this.state.flare = true;
      }
      if (event.code === this.bindings.pause) {
        this.state.pause = true;
      }
      if (event.code === this.bindings.automap) {
        this.state.automap = true;
      }
      if (event.code === this.bindings.nextWeapon) {
        this.state.nextWeapon = true;
      }
    };

    const onKeyUp = (event: Event) => {
      if (!(event instanceof KeyboardEvent)) return;
      this.applyKeyState(event.code, false);
    };

    const onMouseMove = (event: Event) => {
      if (!(event instanceof MouseEvent)) return;
      if (!this.pointerLocked) return;
      this.state.mouseDeltaX += event.movementX;
      this.state.mouseDeltaY += event.movementY;
    };

    target.addEventListener("keydown", onKeyDown);
    target.addEventListener("keyup", onKeyUp);
    target.addEventListener("mousemove", onMouseMove);

    this.detachKeyboard = () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("mousemove", onMouseMove);
    };

    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    if (target instanceof HTMLElement) {
      target.addEventListener("click", this.onPointerLockHint);
      this.detachMouse = () => {
        document.removeEventListener("pointerlockchange", this.onPointerLockChange);
        target.removeEventListener("click", this.onPointerLockHint);
      };
    } else {
      this.detachMouse = () => {
        document.removeEventListener("pointerlockchange", this.onPointerLockChange);
      };
    }
  }

  detach(): void {
    this.detachKeyboard?.();
    this.detachMouse?.();
    this.detachKeyboard = undefined;
    this.detachMouse = undefined;
    this.state = emptyInput();
  }

  consume(): InputSnapshot {
    const snapshot = this.snapshot;
    this.state.flare = false;
    this.state.pause = false;
    this.state.automap = false;
    this.state.nextWeapon = false;
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
    return snapshot;
  }

  clearTransient(): void {
    this.state.flare = false;
    this.state.pause = false;
    this.state.automap = false;
    this.state.nextWeapon = false;
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
  }

  setPointerLocked(value: boolean): void {
    this.pointerLocked = value;
  }

  private applyKeyState(code: string, down: boolean): void {
    switch (code) {
      case this.bindings.thrustForward:
        this.state.thrustForward = down;
        break;
      case this.bindings.thrustBackward:
        this.state.thrustBackward = down;
        break;
      case this.bindings.strafeLeft:
        this.state.strafeLeft = down;
        break;
      case this.bindings.strafeRight:
        this.state.strafeRight = down;
        break;
      case this.bindings.rollLeft:
        this.state.rollLeft = down;
        break;
      case this.bindings.rollRight:
        this.state.rollRight = down;
        break;
      case this.bindings.moveUp:
        this.state.moveUp = down;
        break;
      case this.bindings.moveDown:
        this.state.moveDown = down;
        break;
      case this.bindings.afterburner:
        this.state.afterburner = down;
        break;
      case this.bindings.primaryFire:
        this.state.primaryFire = down;
        break;
      case this.bindings.secondaryFire:
        this.state.secondaryFire = down;
        break;
      default:
        break;
    }
  }

  private onPointerLockChange = () => {
    this.pointerLocked = document.pointerLockElement !== null;
  };

  private onPointerLockHint = (event: Event) => {
    if (event.currentTarget instanceof HTMLElement && !document.pointerLockElement) {
      event.currentTarget.requestPointerLock?.();
    }
  };
}

export const createEmptyInput = emptyInput;
