import streamDeck from "@elgato/streamdeck";

import { ITermNavigate } from "./actions/iterm-navigate";
import { SendToITerm } from "./actions/send-to-iterm";
import { startHookServer } from "./utils/hook-server";

streamDeck.logger.setLevel("trace");

streamDeck.actions.registerAction(new ITermNavigate());
streamDeck.actions.registerAction(new SendToITerm());

startHookServer();

streamDeck.connect();
