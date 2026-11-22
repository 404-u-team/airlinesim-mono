import { apiClient } from "../../api";

export type ExternalProxySettings = {
  origin: null | string;
};

const settingsPath = "/admin/settings/external-proxy";

export async function getExternalProxySettings(): Promise<ExternalProxySettings> {
  return apiClient.get<ExternalProxySettings>(settingsPath);
}

export async function updateExternalProxySettings(proxyUrl: null | string): Promise<ExternalProxySettings> {
  return apiClient.put<ExternalProxySettings>(settingsPath, { proxyUrl });
}
