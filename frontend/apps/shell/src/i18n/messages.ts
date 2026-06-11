import type { LocaleMessages } from "@airlinesim/i18n";

import { enMessages } from "./en";
import { ruMessages } from "./ru";

export const shellMessages = {
  en: enMessages,
  ru: ruMessages,
} satisfies LocaleMessages<ShellMessageKey>;

export type ShellMessageKey = keyof typeof enMessages;
