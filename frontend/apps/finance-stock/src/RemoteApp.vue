<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { airlineSchema } from "@airlinesim/api-contracts";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { createApiClient } from "@airlinesim/game-sdk";
import { onMounted } from "vue";

const apiClient = createApiClient();

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "finance-stock" });
});
const sampleAirline = airlineSchema.safeParse({
  code: "KR",
  id: "00000000-0000-4000-8000-000000000001",
  name: "Korean Regional",
});

function notifySelection(): void {
  airlineSimEventBus.emit("navigation:remote-selected", {
    remoteId: "finance-stock",
  });
}
</script>

<template>
  <section class="min-h-full bg-background p-6 text-body text-text-primary">
    <div class="flex items-start justify-between gap-6 border-b border-border pb-5">
      <div>
        <AirBadge
          label="Finance & Stock"
          variant="success-soft"
        />
        <h1 class="mt-4 text-h2">
          Finance & Stock
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Cash flow, loans, transactions, listings and shareholder activity.
        </p>
      </div>
      <AirButton
        label="Refresh"
        size="sm"
        variant="success"
        @click="notifySelection"
      />
    </div>

    <div class="mt-6 grid gap-4 md:grid-cols-3">
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-caption text-text-muted">
          Contract check
        </p>
        <p class="mt-2 text-subtitle">
          {{ sampleAirline.success ? sampleAirline.data.code : "invalid" }}
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-caption text-text-muted">
          SDK route
        </p>
        <p class="mt-2 text-monospace">
          {{ apiClient ? "/finance" : "-" }}
        </p>
      </div>
      <div class="rounded-lg border border-border bg-surface p-4">
        <p class="text-caption text-text-muted">
          Event bus
        </p>
        <p class="mt-2 text-subtitle">
          navigation events
        </p>
      </div>
    </div>
  </section>
</template>
