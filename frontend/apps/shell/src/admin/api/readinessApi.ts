import type { WorldReadiness } from "../readiness-types";

import { apiClient } from "../../api";

export async function getWorldReadiness(): Promise<WorldReadiness> {
  return apiClient.get<WorldReadiness>("/admin/world/readiness");
}

