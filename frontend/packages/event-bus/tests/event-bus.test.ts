import { expect, test } from "bun:test";

import { createEventBus } from "../src/core/createEventBus";

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
