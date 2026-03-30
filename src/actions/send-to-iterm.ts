import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import { itermSendText, itermSendKeystroke } from "../utils/iterm";

type SendMode = "text" | "ctrl-c";

type SendToITermSettings = {
  mode?: SendMode;
  text?: string;
};

@action({ UUID: "com.sglim.claude-machine.send-to-iterm" })
export class SendToITerm extends SingletonAction<SendToITermSettings> {
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
