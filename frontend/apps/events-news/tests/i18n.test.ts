import { expect, test } from "bun:test";

import { eventMessages, t } from "../src/i18n";

test("events and notifications expose matching en and ru localization keys", () => {
  expect(Object.keys(eventMessages.en).sort()).toEqual(Object.keys(eventMessages.ru).sort());
  expect(t("en", "event.AIRCRAFT_PURCHASED")).toBe("Aircraft purchased");
  expect(t("ru", "event.AIRCRAFT_PURCHASED")).toBe("Самолет куплен");
});
