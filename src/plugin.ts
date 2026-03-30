import streamDeck from "@elgato/streamdeck";

import { ITermNavigate } from "./actions/iterm-navigate";
import { SendToITerm } from "./actions/send-to-iterm";

streamDeck.logger.setLevel("trace");

streamDeck.actions.registerAction(new ITermNavigate());
streamDeck.actions.registerAction(new SendToITerm());

streamDeck.connect();
