import { afterEach, expect, test } from "bun:test";
import type { BffConfig } from "../src/config";
import { handleAdminAircraftTypesRequest } from "../src/modules/admin/aircraft-types";
import { readAircraftImages } from "../src/modules/aircraft-images/storage";

const config: BffConfig = {
  backendBaseUrl: "http://backend.test",
  port: 4200,
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function authorizedRequest(url: string, init?: RequestInit): Request {
  return new Request(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: "Bearer admin-token",
    },
  });
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json",
    },
    status,
  });
}

test("rejects unauthenticated request", async () => {
  const request = new Request("http://bff.test/admin/aircraft-types/images/search?q=A320");
  const response = await handleAdminAircraftTypesRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(401);
});

test("rejects unauthorized request", async () => {
  globalThis.fetch = async () => jsonResponse({ error: "forbidden" }, 403);

  const request = authorizedRequest("http://bff.test/admin/aircraft-types/images/search?q=A320");
  const response = await handleAdminAircraftTypesRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(403);
});

test("returns empty candidates when q is empty", async () => {
  globalThis.fetch = async () => jsonResponse({ countries: [] });

  const request = authorizedRequest("http://bff.test/admin/aircraft-types/images/search?q=");
  const response = await handleAdminAircraftTypesRequest(request, new URL(request.url), config);

  expect(response?.status).toBe(200);
  expect(await response?.json()).toEqual({ candidates: [] });
});

test("updates and deletes custom image override", async () => {
  globalThis.fetch = async () => jsonResponse({ countries: [] });

  const icao = "A320";

  // Verify currently no override exists or default
  const originalImages = readAircraftImages();
  expect(originalImages[icao]).toBeUndefined();

  // PUT override
  const putRequest = authorizedRequest(`http://bff.test/admin/aircraft-types/${icao}/image`, {
    method: "PUT",
    body: JSON.stringify({
      imageUrl: "https://test.image/a320.jpg",
      source: "Test Source",
      title: "Test Airbus A320",
    }),
  });
  const putResponse = await handleAdminAircraftTypesRequest(putRequest, new URL(putRequest.url), config);
  expect(putResponse?.status).toBe(200);
  expect(await putResponse?.json()).toEqual({
    imageUrl: "https://test.image/a320.jpg",
    source: "Test Source",
    title: "Test Airbus A320",
  });

  // Verify updated in storage
  const imagesAfterPut = readAircraftImages();
  expect(imagesAfterPut[icao]).toEqual({
    imageUrl: "https://test.image/a320.jpg",
    source: "Test Source",
    title: "Test Airbus A320",
  });

  // DELETE override
  const deleteRequest = authorizedRequest(`http://bff.test/admin/aircraft-types/${icao}/image`, {
    method: "DELETE",
  });
  const deleteResponse = await handleAdminAircraftTypesRequest(deleteRequest, new URL(deleteRequest.url), config);
  expect(deleteResponse?.status).toBe(200);
  expect(await deleteResponse?.json()).toEqual({ success: true });

  // Verify deleted from storage
  const imagesAfterDelete = readAircraftImages();
  expect(imagesAfterDelete[icao]).toBeUndefined();
});
