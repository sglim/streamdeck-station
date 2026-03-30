import { action, DidReceiveSettingsEvent, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";
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

const MODE_ICONS: Record<string, string> = {
  "tab-prev": "imgs/actions/iterm/key/tab-prev",
  "tab-next": "imgs/actions/iterm/key/tab-next",
  "pane-prev": "imgs/actions/iterm/key/pane-prev",
  "pane-next": "imgs/actions/iterm/key/pane-next",
  "split-vertical": "imgs/actions/iterm/key/split-v",
  "split-horizontal": "imgs/actions/iterm/key/split-h",
  "new-tab": "imgs/actions/iterm/key/new-tab",
};

@action({ UUID: "com.sglim.claude-machine.iterm-navigate" })
export class ITermNavigate extends SingletonAction<ITermNavigateSettings> {
  override async onWillAppear(ev: WillAppearEvent<ITermNavigateSettings>): Promise<void> {
    const mode = ev.payload.settings.mode ?? "tab-next";
    const icon = MODE_ICONS[mode];
    if (icon) {
      await ev.action.setImage(icon);
    }
  }

  override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<ITermNavigateSettings>): Promise<void> {
    const mode = ev.payload.settings.mode ?? "tab-next";
    const icon = MODE_ICONS[mode];
    if (icon) {
      await ev.action.setImage(icon);
    }
  }

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
