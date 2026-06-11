import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from "chart.js";

// Register the Chart.js building blocks once for the whole fleet-ops app.
Chart.register(CategoryScale, Filler, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

// Theme-agnostic palette aligned with the slate/blue tokens used across the UI.
export const chartPalette = {
  grid: "rgba(148, 163, 184, 0.18)",
  primary: "#3b82f6",
  primaryFill: "rgba(59, 130, 246, 0.15)",
  ticks: "#94a3b8",
};
