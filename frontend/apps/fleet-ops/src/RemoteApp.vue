<script setup lang="ts">
import type { FlightStatus } from "@airlinesim/api-contracts";

import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { createApiClient } from "@airlinesim/game-sdk";

const apiClient = createApiClient({ baseUrl: "http://localhost:8000" });
const status: FlightStatus = "scheduled";

function notifySelection(): void {
  airlineSimEventBus.emit("navigation:remote-selected", {
    remoteId: "fleet-ops",
  });
}
</script>

<template>
  <section class="min-h-full bg-background p-6 text-body text-text-primary">
    <div class="flex items-start justify-between gap-6 border-b border-border pb-5">
      <div>
        <AirBadge
          label="Fleet & Ops"
          variant="primary-soft"
        />
        <h1 class="mt-4 text-h2">
          Fleet & Ops
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Aircraft utilization, rotation health, crew readiness and operating alerts.
        </p>
      </div>
      <AirButton
        label="Sync"
        size="sm"
        @click="notifySelection"
      />
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-3">
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-caption text-text-muted">
          API base
        </p>
        <p class="mt-2 text-monospace">
          {{ apiClient ? "/fleet" : "-" }}
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-caption text-text-muted">
          Next flight
        </p>
        <p class="mt-2 text-subtitle">
          {{ status }}
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-caption text-text-muted">
          Shared UI
        </p>
        <p class="mt-2 text-subtitle">
          air-ui connected
        </p>
      </div>
    </div>
  </section>
</template>
