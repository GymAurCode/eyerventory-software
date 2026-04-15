import { createContext, useContext, useMemo } from "react";

const ShortcutContext = createContext(null);

export function ShortcutProvider({ value, children }) {
  const memoValue = useMemo(() => value, [value]);
  return <ShortcutContext.Provider value={memoValue}>{children}</ShortcutContext.Provider>;
}

export function useShortcuts() {
  const ctx = useContext(ShortcutContext);
  if (!ctx) throw new Error("useShortcuts must be used inside ShortcutProvider");
  return ctx;
}
