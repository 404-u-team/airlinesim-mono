import { expect, test } from "bun:test";

import { validateForm } from "../src/admin/form";
import { adminText, localizeAdminLabel } from "../src/admin/i18n";
import type { AdminEntityConfig } from "../src/admin/types";

const countryConfig: AdminEntityConfig = {
  collectionKey: "countries",
  columns: [],
  createPath: "/admin/world/countries",
  description: "",
  editPath: (id) => `/admin/world/countries/${id}`,
  fields: [{ key: "iso", kind: "text", label: "ISO code", required: true }],
  id: "countries",
  listPath: "/admin/world/countries",
  title: "Countries",
};

test("admin UI exposes Russian labels and validation", () => {
  expect(adminText("ru", "readiness")).toBe("Готовность мира");
  expect(localizeAdminLabel("ru", "Countries")).toBe("Страны");
  expect(validateForm(countryConfig, { iso: "kr" }, "ru")).toContain("ISO-код");
});
