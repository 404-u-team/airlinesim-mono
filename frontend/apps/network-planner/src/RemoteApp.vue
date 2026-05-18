<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { airportSchema } from "@airlinesim/api-contracts";
import { airlineSimEventBus } from "@airlinesim/event-bus";

const hub = airportSchema.safeParse({
  city: "Seoul",
  countryCode: "KR",
  iata: "ICN",
  id: "00000000-0000-4000-8000-000000000002",
  name: "Incheon International",
});

function notifySelection(): void {
  airlineSimEventBus.emit("navigation:remote-selected", {
    remoteId: "network-planner",
  });
}
</script>

<template>
  <section class="min-h-full bg-background p-6 text-body text-text-primary">
    <div class="flex items-start justify-between gap-6 border-b border-border pb-5">
      <div>
        <AirBadge
          label="Network Planner"
          variant="warning-soft"
        />
        <h1 class="mt-4 text-h2">
          Network Planner
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Route opportunities, hub structure, connectivity and demand planning.
        </p>
      </div>
      <AirButton
        label="Plan"
        size="sm"
        variant="warning"
        @click="notifySelection"
      />
    </div>
    <div class="mt-6 rounded-lg border border-border bg-surface p-4">
      <p class="text-caption text-text-muted">
        Primary hub
      </p>
      <p class="mt-2 text-subtitle">
        {{ hub.success ? hub.data.name : "Not configured" }}
      </p>
    </div>
  </section>
</template>
