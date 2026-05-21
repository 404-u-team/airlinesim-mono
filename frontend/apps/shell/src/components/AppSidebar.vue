<script setup lang="ts">
import { AirIconButton } from "@airlinesim/air-ui";
import { ChevronDown, Menu } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { navigationSections } from "../navigation";

const props = defineProps<{
  collapsed: boolean;
  companyName: string;
}>();

const emit = defineEmits<{
  toggle: [];
}>();

const route = useRoute();
const expandedSections = ref<string[]>([]);

const sidebarClass = computed(() => [
  "fixed inset-y-0 left-0 z-40 flex h-screen flex-col overflow-hidden border-r border-border bg-surface transition-[width,transform] duration-200 ease-out lg:static lg:translate-x-0",
  props.collapsed ? "w-16 -translate-x-full lg:translate-x-0" : "w-64 translate-x-0",
]);

function isSectionActive(path: string): boolean {
  return route.path === path || route.path.startsWith(`${path}/`);
}

function toggleSection(path: string): void {
  const index = expandedSections.value.indexOf(path);
  if (index > -1) {
    expandedSections.value.splice(index, 1);
  } else {
    expandedSections.value.push(path);
  }
}

// Auto-expand active section
watch(
  () => route.path,
  (path) => {
    const section = navigationSections.find(
      (s) => s.children && (path === s.path || path.startsWith(`${s.path}/`)),
    );
    if (section && !expandedSections.value.includes(section.path)) {
      expandedSections.value.push(section.path);
    }
  },
  { immediate: true },
);
</script>

<template>
  <aside :class="sidebarClass">
    <div class="flex h-14 shrink-0 items-center border-b border-border px-4 overflow-hidden">
      <AirIconButton
        label="Toggle menu"
        size="sm"
        @click="emit('toggle')"
      >
        <Menu :size="20" />
      </AirIconButton>
      <RouterLink
        v-if="!collapsed"
        to="/dashboard"
        class="ml-3 truncate text-h4 text-text-primary"
      >
        {{ companyName }}
      </RouterLink>
    </div>

    <nav class="min-h-0 flex-1 overflow-y-auto px-3 py-4 custom-scrollbar">
      <ul class="space-y-2">
        <li
          v-for="section in navigationSections"
          :key="section.path"
        >
          <button
            v-if="section.children?.length"
            type="button"
            class="flex h-10 w-full items-center gap-3 rounded-md px-2 text-subtitle transition hover:bg-surface-subtle"
            :class="[
              isSectionActive(section.path) ? 'text-primary font-medium' : 'text-text-muted',
              collapsed ? 'justify-center' : ''
            ]"
            @click="toggleSection(section.path)"
          >
            <component
              :is="section.icon"
              :size="18"
              aria-hidden="true"
              class="shrink-0"
            />
            <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-left">
              {{ section.label }}
            </span>
            <ChevronDown
              v-if="!collapsed"
              class="text-text-muted transition-transform duration-200"
              :class="expandedSections.includes(section.path) ? 'rotate-180' : ''"
              :size="16"
              aria-hidden="true"
            />
          </button>

          <RouterLink
            v-else
            :to="section.path"
            class="flex h-10 w-full items-center gap-3 rounded-md px-2 text-subtitle transition hover:bg-surface-subtle"
            :class="[
              isSectionActive(section.path) ? 'text-primary font-medium' : 'text-text-muted',
              collapsed ? 'justify-center' : ''
            ]"
          >
            <component
              :is="section.icon"
              :size="18"
              aria-hidden="true"
              class="shrink-0"
            />
            <span v-if="!collapsed" class="min-w-0 flex-1 truncate text-left">
              {{ section.label }}
            </span>
          </RouterLink>

          <ul
            v-if="section.children?.length && expandedSections.includes(section.path) && !collapsed"
            class="mt-1 space-y-1 pl-9"
          >
            <li
              v-for="child in section.children"
              :key="child.path"
            >
              <RouterLink
                :to="child.path"
                class="block rounded-md px-2 py-1.5 text-body transition hover:bg-surface-subtle"
                :class="route.path === child.path ? 'text-primary font-medium' : 'text-text-muted'"
              >
                {{ child.label }}
              </RouterLink>
            </li>
          </ul>
        </li>
      </ul>
    </nav>
  </aside>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--color-border);
  border-radius: 3px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--color-text-muted), transparent 20%);
}
.custom-scrollbar {
  scrollbar-width: thin;
  scrollbar-color: var(--color-border) transparent;
}
</style>
