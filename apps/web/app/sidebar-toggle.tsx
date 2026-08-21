"use client";
import { useEffect, useState } from "react";

export default function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show toggle when sidebar is present (i.e. workspace view, not login)
    const check = () => {
      setVisible(!!document.querySelector(".sidebar"));
    };

    check();

    // Watch for sidebar being added/removed from DOM
    const observer = new MutationObserver(check);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    document.body.classList.toggle("sidebar-collapsed", collapsed);
  }, [collapsed]);

  if (!visible) return null;

  return (
    <button
      className="sidebar-toggle"
      type="button"
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={() => setCollapsed((v) => !v)}
    >
      {collapsed ? "›" : "‹"}
    </button>
  );
}
