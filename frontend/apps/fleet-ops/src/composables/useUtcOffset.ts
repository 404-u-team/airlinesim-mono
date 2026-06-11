import { computed, type ComputedRef, isRef, type Ref } from "vue";

export function useUtcOffset(
  timezone: (() => string | undefined) | Ref<string | undefined> | string | undefined
): ComputedRef<number> {
  return computed(() => {
    let tz: string | undefined;
    if (typeof timezone === "function") {
      tz = timezone();
    } else if (isRef(timezone)) {
      tz = timezone.value;
    } else {
      tz = timezone;
    }
    if (!tz) {
      return 0;
    }
    try {
      const now = new Date();
      const parts = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        minute: "numeric",
        timeZone: tz,
      }).formatToParts(now);
      const localH = (Number(parts.find((p) => p.type === "hour")?.value ?? 0) % 24)
        + Number(parts.find((p) => p.type === "minute")?.value ?? 0) / 60;
      const utcH = now.getUTCHours() + now.getUTCMinutes() / 60;
      let diff = localH - utcH;
      // Normalise to [-12, +12]
      if (diff > 12) {
        diff -= 24;
      }
      if (diff < -12) {
        diff += 24;
      }
      return diff;
    } catch {
      return 0;
    }
  });
}
