import "@testing-library/jest-dom";
import React from "react";
import { vi } from "vitest";

// Mock TanStack Router
vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => React.createElement("a", props, children),
}));

// Global window mock for back navigation if needed
Object.defineProperty(window, 'history', {
  value: { back: vi.fn() },
  writable: true
});
