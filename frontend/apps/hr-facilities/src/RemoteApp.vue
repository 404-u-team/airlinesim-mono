<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { createApiClient } from "@airlinesim/game-sdk";
import { onMounted } from "vue";

const apiClient = createApiClient();

onMounted(() => {
  airlineSimEventBus.emit("mfe:ready", { remoteId: "hr-facilities" });
});

function notifySelection(): void {
  airlineSimEventBus.emit("navigation:remote-selected", {
    remoteId: "hr-facilities",
  });
}
</script>

<template>
  <section class="min-h-full bg-background p-6 text-body text-text-primary">
    <div class="flex items-start justify-between gap-6 border-b border-border pb-5">
      <div>
        <AirBadge
          label="HR & Facilities"
          variant="primary-soft"
        />
        <h1 class="mt-4 text-h2">
          HR & Facilities
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Staffing, training, airport facilities and ground infrastructure.
        </p>
      </div>
      <AirButton
        label="Inspect"
        size="sm"
        @click="notifySelection"
      />
    </div>
    <div class="mt-6 rounded-lg border border-border bg-surface p-4">
      <p class="text-caption text-text-muted">
        SDK route
      </p>
      <p class="mt-2 text-monospace">
        {{ apiClient ? "/facilities" : "-" }}
      </p>
    </div>
  </section>
</template>
