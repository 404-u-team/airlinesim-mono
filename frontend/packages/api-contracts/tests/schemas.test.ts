import { expect, test } from "bun:test";

import { airlineSchema, flightStatusSchema } from "../src";

test("validates airline shape", () => {
  const airline = airlineSchema.parse({
    code: "AS",
    id: "11111111-1111-4111-8111-111111111111",
    name: "AirlineSim",
  });

  expect(airline.code).toBe("AS");
});

test("allows known flight statuses only", () => {
  expect(flightStatusSchema.safeParse("scheduled").success).toBe(true);
  expect(flightStatusSchema.safeParse("unknown").success).toBe(false);
});
