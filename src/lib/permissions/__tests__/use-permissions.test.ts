import { describe, it, expect, vi, beforeEach } from "vitest";
import { usePermissions } from "@/hooks/use-permissions";
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

describe("usePermissions logic", () => {
  const mockUser = { id: "user-123" };

  beforeEach(() => {
    vi.clearAllMocks();
    (useAuthSession as any).mockReturnValue({ user: mockUser });
  });

  it("should return false for all actions when loading", () => {
    (useQuery as any).mockReturnValue({ isLoading: true });
    
    const result = usePermissions();
    
    expect(result.can("any", "view")).toBe(false);
    expect(result.isLoading).toBe(true);
  });

  it("should correctly identify query keys for cache isolation", () => {
    (useQuery as any).mockImplementation(({ queryKey }: any) => {
      if (queryKey[0] === "user-profile-permission") {
        return { data: { permission_profile_id: "profile-A" }, isLoading: false };
      }
      return { data: { profile: { id: "profile-A", active: true }, map: {} }, isLoading: false };
    });

    usePermissions();

    // Verify first query key
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ["user-profile-permission", "user-123"]
    }));

    // Verify second query key with both userId and profileId
    expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({
      queryKey: ["permissions", "user-123", "profile-A"]
    }));
  });
});