<script setup lang="ts">
import { AirBadge, AirButton } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";

function notifySelection(): void {
  airlineSimEventBus.emit("notification:created", {
    message: "Events remote connected",
    severity: "info",
  });
}
</script>

<template>
  <section class="min-h-full bg-background p-6 text-body text-text-primary">
    <div class="flex items-start justify-between gap-6 border-b border-border pb-5">
      <div>
        <AirBadge
          label="Events & News"
          variant="danger-soft"
        />
        <h1 class="mt-4 text-h2">
          Events & News
        </h1>
        <p class="mt-2 max-w-2xl text-body text-text-muted">
          Market events, operational alerts, news feed and player actions.
        </p>
      </div>
      <AirButton
        label="Broadcast"
        size="sm"
        variant="danger"
        @click="notifySelection"
      />
    </div>
    <div class="mt-6 rounded-lg border border-border bg-surface p-4">
      <p class="text-caption text-text-muted">
        Live channel
      </p>
      <p class="mt-2 text-subtitle">
        event-bus notification stream
      </p>
    </div>
  </section>
</template>
