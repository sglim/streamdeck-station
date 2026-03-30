import { action, KeyDownEvent, SingletonAction } from "@elgato/streamdeck";
import {
  itermTabNavigate,
  itermSplit,
  itermPaneNavigate,
  itermNewTab,
} from "../utils/iterm";

type NavigateMode = "tab-prev" | "tab-next" | "pane-prev" | "pane-next"
  | "split-vertical" | "split-horizontal" | "new-tab";

type ITermNavigateSettings = {
  mode?: NavigateMode;
};

@action({ UUID: "com.sglim.claude-machine.iterm-navigate" })
export class ITermNavigate extends SingletonAction<ITermNavigateSettings> {
  override async onKeyDown(ev: KeyDownEvent<ITermNavigateSettings>): Promise<void> {
    const mode = ev.payload.settings.mode ?? "tab-next";

    try {
      switch (mode) {
        case "tab-prev":
          await itermTabNavigate(-1);
          break;
        case "tab-next":
          await itermTabNavigate(1);
          break;
        case "pane-prev":
          await itermPaneNavigate("prev");
          break;
        case "pane-next":
          await itermPaneNavigate("next");
          break;
        case "split-vertical":
          await itermSplit("vertical");
          break;
        case "split-horizontal":
          await itermSplit("horizontal");
          break;
        case "new-tab":
          await itermNewTab();
          break;
      }
      await ev.action.showOk();
    } catch {
      await ev.action.showAlert();
    }
  }
}
