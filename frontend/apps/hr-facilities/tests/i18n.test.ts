import { expect, test } from "bun:test";

import { facilitiesMessages, t } from "../src/i18n";

test("facilities exposes matching en and ru localization keys", () => {
  expect(Object.keys(facilitiesMessages.en).sort()).toEqual(Object.keys(facilitiesMessages.ru).sort());
  expect(t("en", "constraint.AIRPORT_SLOT_CAPACITY_EXCEEDED")).toContain("capacity");
  expect(t("ru", "constraint.AIRPORT_SLOT_CAPACITY_EXCEEDED")).toContain("пропускную");
});
