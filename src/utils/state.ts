import { EventEmitter } from "node:events";

export type ClaudeState =
  | "disconnected"
  | "idle"
  | "thinking"
  | "processing"
  | "stopped";

export interface HookEvent {
  type: string;
  tool?: string;
  toolInput?: Record<string, unknown>;
  timestamp: number;
}

class ClaudeStateManager extends EventEmitter {
  private _state: ClaudeState = "disconnected";
  private _lastEvent: HookEvent | null = null;
  private _toolName: string | null = null;

  get state(): ClaudeState {
    return this._state;
  }

  get lastEvent(): HookEvent | null {
    return this._lastEvent;
  }

  get toolName(): string | null {
    return this._toolName;
  }

  setState(newState: ClaudeState): void {
    const prev = this._state;
    this._state = newState;
    if (prev !== newState) {
      this.emit("stateChange", { prev, current: newState });
    }
  }

  handleHookEvent(eventType: string, data: Record<string, unknown>): void {
    const event: HookEvent = {
      type: eventType,
      tool: data.tool as string | undefined,
      toolInput: data.tool_input as Record<string, unknown> | undefined,
      timestamp: Date.now(),
    };
    this._lastEvent = event;

    switch (eventType) {
      case "UserPromptSubmit":
        this._toolName = null;
        this.setState("thinking");
        break;
      case "PreToolUse":
        this._toolName = event.tool ?? null;
        this.setState("processing");
        break;
      case "PostToolUse":
        this._toolName = null;
        this.setState("thinking");
        break;
      case "Stop":
        this._toolName = null;
        this.setState("stopped");
        setTimeout(() => {
          if (this._state === "stopped") {
            this.setState("idle");
          }
        }, 3000);
        break;
      case "Notification":
        this.emit("notification", data);
        break;
      default:
        break;
    }

    this.emit("hookEvent", event);
  }
}

export const claudeState = new ClaudeStateManager();
