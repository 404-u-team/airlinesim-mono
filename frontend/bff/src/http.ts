export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const response = new Response(JSON.stringify(body), init);
  response.headers.set("Content-Type", "application/json");

  return response;
}

export function notFound(): Response {
  return jsonResponse({ error: "Not found" }, { status: 404 });
}

export async function readJson<TValue>(request: Request): Promise<TValue> {
  return (await request.json()) as TValue;
}
