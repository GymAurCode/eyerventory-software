import { useEffect, useMemo, useState } from "react";

function getChartTheme() {
  if (typeof window === "undefined") {
    return {
      grid: "#27272A",
      tooltipStyle: { background: "#101010", border: "1px solid #262626", borderRadius: 10, color: "#E5E5E5" },
      tooltipItemStyle: { color: "#E5E5E5" },
      tooltipLabelStyle: { color: "#A1A1AA" },
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const textPrimary = styles.getPropertyValue("--text-primary").trim() || "#E5E5E5";
  const textSecondary = styles.getPropertyValue("--text-secondary").trim() || "#A1A1AA";
  return {
    grid: styles.getPropertyValue("--chart-grid").trim() || "#27272A",
    tooltipStyle: {
      background: styles.getPropertyValue("--tooltip-bg").trim() || "#101010",
      border: `1px solid ${styles.getPropertyValue("--tooltip-border").trim() || "#262626"}`,
      borderRadius: 10,
      color: textPrimary,
    },
    tooltipItemStyle: { color: textPrimary },
    tooltipLabelStyle: { color: textSecondary },
  };
}

export function useChartTheme() {
  const [themeTick, setThemeTick] = useState(0);

  useEffect(() => {
    const observer = new MutationObserver(() => setThemeTick((prev) => prev + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return useMemo(() => getChartTheme(), [themeTick]);
}
