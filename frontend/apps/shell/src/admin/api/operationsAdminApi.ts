import type { ApiClient } from "@airlinesim/game-sdk";

import type { AdminEntityConfig, AdminRecord } from "../types";

export type OperationsAdminApi = {
  createRecord: (config: AdminEntityConfig, payload: Record<string, unknown>) => Promise<IdResponse>;
  deleteRecord: (config: AdminEntityConfig, id: string) => Promise<IdResponse>;
  listRecords: (config: AdminEntityConfig) => Promise<AdminRecord[]>;
  updateRecord: (
    config: AdminEntityConfig,
    id: string,
    payload: Record<string, unknown>,
  ) => Promise<IdResponse>;
};

type IdResponse = {
  id?: string;
};

export function createOperationsAdminApi(apiClient: ApiClient): OperationsAdminApi {
  return {
    createRecord: async (config, payload) => apiClient.post(config.createPath, payload),
    deleteRecord: async (config, id) => apiClient.delete(config.editPath(id)),
    listRecords: async (config) => {
      const response = await apiClient.get<Record<string, AdminRecord[] | undefined>>(
        config.listPath,
      );

      return response[config.collectionKey] ?? [];
    },
    updateRecord: async (config, id, payload) => apiClient.put(config.editPath(id), payload),
  };
}
