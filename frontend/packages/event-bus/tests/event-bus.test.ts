import { expect, test } from "bun:test";

import { createEventBus } from "../src/core/createEventBus";
import { airlineSimEventValidators } from "../src/contracts/validators";

type TestEvents = {
  "flight:selected": { id: string };
};

test("emits payloads to subscribed listeners", () => {
  const bus = createEventBus<TestEvents>();
  const received: string[] = [];

  bus.on("flight:selected", (payload) => {
    received.push(payload.id);
  });

  bus.emit("flight:selected", { id: "SU100" });

  expect(received).toEqual(["SU100"]);
});

test("removes once listeners after first emit", () => {
  const bus = createEventBus<TestEvents>();
  let count = 0;

  bus.once("flight:selected", () => {
    count += 1;
  });

  bus.emit("flight:selected", { id: "SU100" });
  bus.emit("flight:selected", { id: "SU101" });

  expect(count).toBe(1);
  expect(bus.listenerCount("flight:selected")).toBe(0);
});

test("accepts valid event and notification invalidation payloads", () => {
  expect(airlineSimEventValidators["events:invalidated"]({
    reason: "flight-completed",
    source: "fleet-ops",
  })).toBe(true);
  expect(airlineSimEventValidators["notifications:invalidated"]({
    reason: "schedule-activated",
    source: "fleet-ops",
  })).toBe(true);
});

test("rejects unknown invalidation reasons and sources", () => {
  expect(airlineSimEventValidators["events:invalidated"]({
    reason: "unknown",
    source: "fleet-ops",
  })).toBe(false);
  expect(airlineSimEventValidators["notifications:invalidated"]({
    reason: "risk-changed",
    source: "unknown",
  })).toBe(false);
});
