export type { Airline, Airport, Flight, FlightStatus } from "@airlinesim/api-contracts";

export type ApiClient = {
  get: <TResponse>(path: string) => Promise<TResponse>;
};

export type ApiClientOptions = {
  baseUrl: string;
  getToken?: () => null | string;
};

export function createApiClient(options: ApiClientOptions): ApiClient {
  async function get<TResponse>(path: string): Promise<TResponse> {
    const headers = new Headers();
    const token = options.getToken?.();

    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const response = await fetch(new URL(path, options.baseUrl), {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${String(response.status)}`);
    }

    return response.json() as Promise<TResponse>;
  }

  return {
    get,
  };
}
