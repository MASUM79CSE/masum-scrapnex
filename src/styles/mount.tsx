import { StrictMode, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import "./base.css";

export function mount(content: ReactNode) {
  const root = document.getElementById("root");
  if (!root) throw new Error("Extension page root is missing.");
  createRoot(root).render(<StrictMode>{content}</StrictMode>);
}
