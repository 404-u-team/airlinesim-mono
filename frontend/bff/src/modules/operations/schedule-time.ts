export function addMinutesToLocalTime(time: string, minutes: number): { dayOffset: number; time: string } {
  const [hour = "0", minute = "0"] = time.split(":");
  const total = Number(hour) * 60 + Number(minute) + minutes;
  const normalized = ((total % 1440) + 1440) % 1440;

  return {
    dayOffset: Math.floor(total / 1440),
    time: `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`,
  };
}

/**
 * Converts a wall-clock time (the local departure time at the origin airport) on
 * a given calendar day into the correct UTC instant. Without a timezone the wall
 * time is treated as UTC. A single offset correction is accurate outside DST
 * transition hours, which is sufficient for MVP scheduling.
 */
export function zonedWallTimeToUtc(date: Date, hour: number, minute: number, timeZone?: string): Date {
  const wallAsUtc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), hour, minute, 0, 0);

  if (!timeZone) {
    return new Date(wallAsUtc);
  }

  return new Date(wallAsUtc - zoneOffsetMs(new Date(wallAsUtc), timeZone));
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      day: "2-digit",
      hour: "2-digit",
      hour12: false,
      minute: "2-digit",
      month: "2-digit",
      second: "2-digit",
      timeZone,
      year: "numeric",
    }).formatToParts(instant);
    const lookup = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? "0");
    const hour = lookup("hour") % 24;
    const asZoned = Date.UTC(lookup("year"), lookup("month") - 1, lookup("day"), hour, lookup("minute"), lookup("second"));

    return asZoned - instant.getTime();
  } catch {
    return 0;
  }
}
