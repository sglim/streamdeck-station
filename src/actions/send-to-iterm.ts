import { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import { itermSendText, itermSendKeystroke } from "../utils/iterm";
import { claudeState, type ClaudeState } from "../utils/state";

type SendMode = "text" | "ctrl-c";

type SendToITermSettings = {
  mode?: SendMode;
  text?: string;
};

function getIconForSettings(settings: SendToITermSettings): string {
  if (settings.mode === "ctrl-c") return "imgs/actions/send/key/stop";
  const text = settings.text ?? "";
  if (text === "y" || text === "yes") return "imgs/actions/send/key/yes";
  if (text.startsWith("/commit")) return "imgs/actions/send/key/commit";
  return "imgs/actions/send/key/text";
}

@action({ UUID: "com.sglim.claude-machine.send-to-iterm" })
export class SendToITerm extends SingletonAction<SendToITermSettings> {
  private stateListener: ((change: { current: ClaudeState }) => void) | null = null;

  override async onWillAppear(ev: WillAppearEvent<SendToITermSettings>): Promise<void> {
    const icon = getIconForSettings(ev.payload.settings);
    await ev.action.setImage(icon);

    // STOP 버튼은 Claude 상태에 따라 동적 타이틀 변경
    if (ev.payload.settings.mode === "ctrl-c") {
      this.stateListener = ({ current }) => {
        const title = current === "processing" ? "⏳ STOP" : "STOP";
        ev.action.setTitle(title);
      };
      claudeState.on("stateChange", this.stateListener);
    }
  }

  override async onWillDisappear(): Promise<void> {
    if (this.stateListener) {
      claudeState.off("stateChange", this.stateListener);
      this.stateListener = null;
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<SendToITermSettings>): Promise<void> {
    const icon = getIconForSettings(ev.payload.settings);
    await ev.action.setImage(icon);
  }

  override async onKeyDown(ev: KeyDownEvent<SendToITermSettings>): Promise<void> {
    const { mode = "text", text = "" } = ev.payload.settings;

    try {
      switch (mode) {
        case "ctrl-c":
          await itermSendKeystroke("c", ["control"]);
          break;
        case "text":
          if (text) {
            await itermSendText(text);
          }
          break;
      }
      await ev.action.showOk();
    } catch {
      await ev.action.showAlert();
    }
  }
}
