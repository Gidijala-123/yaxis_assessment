"use client";
import { useEffect, useState } from "react";

export default function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const check = () => setVisible(!!document.querySelector(".sidebar"));
    check();
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
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          width: 13,
          height: 13,
          transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
          transform: collapsed ? "rotate(0deg)" : "rotate(180deg)",
        }}
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    </button>
  );
}
