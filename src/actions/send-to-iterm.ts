import { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
import streamDeck from "@elgato/streamdeck";
import { itermSendText, itermSendKeystroke } from "../utils/iterm";
import { claudeState, type ClaudeState } from "../utils/state";
import { getSendIcon, STOP_PROCESSING_ICON } from "../utils/icons";

type SendMode = "text" | "ctrl-c";

type SendToITermSettings = {
  mode?: SendMode;
  text?: string;
};

@action({ UUID: "com.sglim.claude-machine.send-to-iterm" })
export class SendToITerm extends SingletonAction<SendToITermSettings> {
  private stateListener: ((change: { current: ClaudeState }) => void) | null = null;

  override async onWillAppear(ev: WillAppearEvent<SendToITermSettings>): Promise<void> {
    const { mode = "text", text = "" } = ev.payload.settings;
    streamDeck.logger.info(`send-to-iterm onWillAppear: mode=${mode} text=${text}`);
    const icon = getSendIcon(mode, text);
    if (icon) {
      await ev.action.setImage(icon);
    }

    if (mode === "ctrl-c") {
      const stopIcon = getSendIcon("ctrl-c", "");
      this.stateListener = ({ current }) => {
        if (current === "processing") {
          ev.action.setImage(STOP_PROCESSING_ICON);
          ev.action.setTitle("⏳ STOP");
        } else {
          ev.action.setImage(stopIcon);
          ev.action.setTitle("STOP");
        }
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
    const { mode = "text", text = "" } = ev.payload.settings;
    const icon = getSendIcon(mode, text);
    if (icon) {
      await ev.action.setImage(icon);
    }
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
