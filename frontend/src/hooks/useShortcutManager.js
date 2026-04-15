import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SHORTCUTS } from "../config/shortcuts";

function isTypingTarget(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable;
}

function eventToCombo(event) {
  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  let key = event.key;
  if (key.length === 1) key = key.toUpperCase();
  if (key === " ") key = "Space";
  if (key === "Escape") key = "Esc";
  parts.push(key);
  return parts.join("+");
}

export function useShortcutManager({ role, dispatchAction }) {
  const pageActionsRef = useRef({});
  const [version, setVersion] = useState(0);
  const [activeActionId, setActiveActionId] = useState("");

  const registerPageAction = useCallback((actionId, handler, options = {}) => {
    pageActionsRef.current[actionId] = { handler, enabled: options.enabled ?? true };
    setVersion((v) => v + 1);
    return () => {
      delete pageActionsRef.current[actionId];
      setVersion((v) => v + 1);
    };
  }, []);

  const setActionEnabled = useCallback((actionId, enabled) => {
    if (!pageActionsRef.current[actionId]) return;
    pageActionsRef.current[actionId].enabled = enabled;
    setVersion((v) => v + 1);
  }, []);

  const enabledActionIds = useMemo(() => {
    const ids = ["app.commandPalette", "app.help", "app.themeToggle", "nav.products", "nav.sales", "nav.expenses"];
    if (role === "owner") ids.push("nav.dashboard", "nav.finance", "nav.users");
    Object.entries(pageActionsRef.current).forEach(([id, entry]) => {
      if (entry.enabled) ids.push(id);
    });
    return ids;
  }, [role, version]);

  const triggerAction = useCallback((actionId) => {
    const pageAction = pageActionsRef.current[actionId];
    if (pageAction?.enabled) {
      pageAction.handler();
      setActiveActionId(actionId);
      window.setTimeout(() => setActiveActionId(""), 450);
      return true;
    }
    const ok = dispatchAction(actionId);
    if (ok) {
      setActiveActionId(actionId);
      window.setTimeout(() => setActiveActionId(""), 450);
    }
    return ok;
  }, [dispatchAction]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (isTypingTarget(event.target)) return;
      const combo = eventToCombo(event);
      const candidates = enabledActionIds
        .filter((id) => SHORTCUTS[id]?.combo === combo)
        .sort((a, b) => (SHORTCUTS[b]?.priority || 0) - (SHORTCUTS[a]?.priority || 0));
      const actionId = candidates[0];
      if (!actionId) return;
      event.preventDefault();
      triggerAction(actionId);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabledActionIds, triggerAction]);

  return { registerPageAction, setActionEnabled, triggerAction, activeActionId };
}
