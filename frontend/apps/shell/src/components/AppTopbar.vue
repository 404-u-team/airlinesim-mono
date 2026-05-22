<script setup lang="ts">
import { AirIconButton } from "@airlinesim/air-ui";
import { airlineSimEventBus } from "@airlinesim/event-bus";
import { Bell, LogOut, Menu, Search, UserRound } from "@lucide/vue";
import { useRouter } from "vue-router";

import { logout } from "../auth";
import { statusMetrics } from "../navigation";

defineEmits<{
  "toggle-menu": [];
}>();

const router = useRouter();

function requestPanel(panel: "notifications" | "profile"): void {
  airlineSimEventBus.emit("shell:panel-requested", {
    panel,
  });
}

function signOut(): void {
  logout("manual");
  void router.replace("/login");
}
</script>

<template>
  <header class="flex h-14 shrink-0 items-center border-b border-border bg-surface px-3 text-text-primary sm:px-5">
    <AirIconButton
      class="lg:hidden"
      label="Open menu"
      size="sm"
      @click="$emit('toggle-menu')"
    >
      <Menu :size="20" />
    </AirIconButton>

    <div class="ml-2 hidden min-w-0 items-center gap-6 md:flex">
      <div
        v-for="metric in statusMetrics"
        :key="metric.label"
        class="flex items-center gap-2 whitespace-nowrap text-body text-text-muted"
      >
        <component
          :is="metric.icon"
          :size="18"
          aria-hidden="true"
        />
        <span>{{ metric.label }}</span>
        <strong class="text-subtitle text-text-primary">
          {{ metric.value }}
        </strong>
      </div>
    </div>

    <div class="ml-auto flex min-w-0 items-center gap-3">
      <label
        class="hidden h-9 w-[min(28vw,320px)] items-center gap-2 rounded-lg bg-surface-subtle px-3 text-text-muted lg:flex"
      >
        <Search
          :size="16"
          aria-hidden="true"
        />
        <input
          class="min-w-0 flex-1 bg-transparent text-body text-text-primary outline-none placeholder:text-text-muted"
          placeholder="Search aircraft, routes, airport..."
          type="search"
        />
        <kbd class="rounded border border-border bg-surface px-1.5 py-0.5 text-caption text-text-muted">
          ⌘K
        </kbd>
      </label>

      <div class="hidden whitespace-nowrap text-monospace text-text-muted sm:block">
        14:36 UTC · 03.12.2025
      </div>

      <button
        class="relative inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-subtle hover:text-text-primary"
        type="button"
        aria-label="Notifications"
        title="Notifications"
        @click="requestPanel('notifications')"
      >
        <Bell :size="18" />
        <span class="absolute right-1.5 top-1.5 size-2 rounded-full bg-error" />
      </button>

      <button
        class="inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-subtle hover:text-text-primary"
        type="button"
        aria-label="Profile"
        title="Profile"
        @click="requestPanel('profile')"
      >
        <UserRound :size="18" />
      </button>

      <button
        class="inline-flex size-9 items-center justify-center rounded-lg text-text-muted transition hover:bg-surface-subtle hover:text-text-primary"
        type="button"
        aria-label="Sign out"
        title="Sign out"
        @click="signOut"
      >
        <LogOut :size="18" />
      </button>
    </div>
  </header>
</template>
