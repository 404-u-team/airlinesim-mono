import {
  BarController,
  BarElement,
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

// Register the Chart.js building blocks once for the whole finance app.
Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
);

// Theme-agnostic palette aligned with the slate/blue tokens used across the UI.
export const chartPalette = {
  grid: "rgba(148, 163, 184, 0.18)",
  loss: "#dc2626",
  primary: "#3b82f6",
  primaryFill: "rgba(59, 130, 246, 0.15)",
  profit: "#16a34a",
  ticks: "#94a3b8",
};
