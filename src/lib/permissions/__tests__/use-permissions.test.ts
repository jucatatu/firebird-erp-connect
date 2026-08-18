import { renderHook, waitFor } from "@testing-library/react";
import { usePermissions } from "../use-permissions";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useAuthSession } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";

vi.mock("@/hooks/use-auth", () => ({
  useAuthSession: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});

describe("usePermissions", () => {
  const mockUser = { id: "user-123" };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthSession as any).mockReturnValue({ user: mockUser });
  });

  it("should return false for all actions when loading", () => {
    (useQuery as any).mockReturnValue({ isLoading: true });
    
    const { result } = renderHook(() => usePermissions());
    
    expect(result.current.can("any", "view")).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("should correctly identify query keys for cache isolation", () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === "user-profile-permission") {
        return { data: { permission_profile_id: "profile-A" }, isLoading: false };
      }
      return { data: { profile: { id: "profile-A", active: true }, map: {} }, isLoading: false };
    });

    renderHook(() => usePermissions());

    // Verify first query key
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ["user-profile-permission", "user-123"]
    }));

    // Verify second query key with both userId and profileId
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ["permissions", "user-123", "profile-A"]
    }));
  });

  it("should return false if profile is inactive", async () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === "user-profile-permission") {
        return { data: { permission_profile_id: "profile-A" }, isLoading: false };
      }
      return { 
        data: { 
          profile: { id: "profile-A", active: false }, 
          map: { "res": { view: true, create: true, edit: true, delete: true } } 
        }, 
        isLoading: false 
      };
    });

    const { result } = renderHook(() => usePermissions());
    
    // In this specific test, if inactive, the hook's internal queryFn returns empty map
    // We mock that behavior here
    (useQuery as any).mockReturnValue({
        data: { profile: { active: false }, map: {} },
        isLoading: false
    });

    expect(result.current.can("res", "view")).toBe(false);
  });
});