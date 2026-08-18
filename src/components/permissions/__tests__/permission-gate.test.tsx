import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionGate } from "../permission-gate";
import { usePermissions } from "@/hooks/use-permissions";
import React from "react";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

// Mock PermissionDenied to avoid complex router dependencies in this test
vi.mock("../permission-denied", () => ({
  PermissionDenied: () => <div data-testid="permission-denied">Acesso Negado</div>,
}));

// Mock Skeleton
vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={className} />
  ),
}));

describe("PermissionGate Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Usuário autorizado: renderiza children", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isLoading: false,
    });

    render(
      <PermissionGate resource="orders" action="view">
        <div data-testid="protected-content">Content</div>
      </PermissionGate>
    );

    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
    expect(screen.queryByTestId("permission-denied")).not.toBeInTheDocument();
  });

  it("2. Usuário sem permissão view: renderiza PermissionDenied e oculta conteúdo", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <PermissionGate resource="orders" action="view">
        <div data-testid="protected-content">Content</div>
      </PermissionGate>
    );

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("permission-denied")).toBeInTheDocument();
  });

  it("3. Fallback customizado: renderiza fallback quando a permissão é negada", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <PermissionGate 
        resource="orders" 
        action="edit" 
        fallback={<div data-testid="custom-fallback">No Edit Access</div>}
      >
        <button data-testid="protected-button">Edit</button>
      </PermissionGate>
    );

    expect(screen.queryByTestId("protected-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("custom-fallback")).toBeInTheDocument();
  });

  it("4. Loading: não libera conteúdo protegido antecipadamente", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(true), // Mock returns true but isLoading is true
      isLoading: true,
    });

    render(
      <PermissionGate resource="orders" action="view" showLoading={true}>
        <div data-testid="protected-content">Content</div>
      </PermissionGate>
    );

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
  });

  it("5. Após resolução permitida: children passa a ser renderizado corretamente (via rerender)", () => {
    const { rerender } = render(
      <PermissionGate resource="orders" action="view">
        <div data-testid="protected-content">Content</div>
      </PermissionGate>
    );

    // First state: Loading
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isLoading: true,
    });
    rerender(
      <PermissionGate resource="orders" action="view">
        <div data-testid="protected-content">Content</div>
      </PermissionGate>
    );
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();

    // Second state: Resolved with permission
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isLoading: false,
    });
    rerender(
      <PermissionGate resource="orders" action="view">
        <div data-testid="protected-content">Content</div>
      </PermissionGate>
    );
    expect(screen.getByTestId("protected-content")).toBeInTheDocument();
  });
});
