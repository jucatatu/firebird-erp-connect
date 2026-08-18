import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionAction } from "../permission-action";
import { usePermissions } from "@/hooks/use-permissions";
import React from "react";

vi.mock("@/hooks/use-permissions", () => ({
  usePermissions: vi.fn(),
}));

// Mock Tooltip components since they rely on complex Radix behavior
vi.mock("@/components/ui/tooltip", () => ({
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
}));

describe("PermissionAction Component", () => {
  const mockOnClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Permissão concedida: botão permanece habilitado", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isLoading: false,
    });

    render(
      <PermissionAction resource="orders" action="edit">
        <button onClick={mockOnClick}>Action</button>
      </PermissionAction>
    );

    const button = screen.getByRole("button", { name: /action/i });
    expect(button).not.toBeDisabled();
    expect(button).not.toHaveAttribute("aria-disabled", "true");
  });

  it("2 & 3. Permissão negada: botão continua visível e disabled = true", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <PermissionAction resource="orders" action="edit">
        <button onClick={mockOnClick}>Action</button>
      </PermissionAction>
    );

    const button = screen.getByRole("button", { name: /action/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  it("4. Permissão negada: aria-disabled = true", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <PermissionAction resource="orders" action="edit">
        <button onClick={mockOnClick}>Action</button>
      </PermissionAction>
    );

    const button = screen.getByRole("button", { name: /action/i });
    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("5. Botão originalmente disabled: continua disabled mesmo quando a permissão é concedida", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isLoading: false,
    });

    render(
      <PermissionAction resource="orders" action="edit">
        <button onClick={mockOnClick} disabled={true}>Action</button>
      </PermissionAction>
    );

    const button = screen.getByRole("button", { name: /action/i });
    expect(button).toBeDisabled();
  });

  it("6. Permissão negada: click não executa a ação (HTML disabled prevents click)", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(false),
      isLoading: false,
    });

    render(
      <PermissionAction resource="orders" action="edit">
        <button onClick={mockOnClick}>Action</button>
      </PermissionAction>
    );

    const button = screen.getByRole("button", { name: /action/i });
    fireEvent.click(button);
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it("7. Permissão concedida: click executa normalmente", () => {
    (usePermissions as any).mockReturnValue({
      can: vi.fn().mockReturnValue(true),
      isLoading: false,
    });

    render(
      <PermissionAction resource="orders" action="edit">
        <button onClick={mockOnClick}>Action</button>
      </PermissionAction>
    );

    const button = screen.getByRole("button", { name: /action/i });
    fireEvent.click(button);
    expect(mockOnClick).toHaveBeenCalledTimes(1);
  });
});
