import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { 
  PermissionAction, 
  PermissionMap, 
  UserPermissionProfile,
  PermissionFlags 
} from "@/lib/permissions/permission-types";
import { useAuth } from "@/hooks/use-auth";

const DEFAULT_FLAGS: PermissionFlags = {
  view: false,
  create: false,
  edit: false,
  delete: false,
};

export function usePermissions() {
  const { user } = useAuth();

  const { data: permissions, isLoading, error } = useQuery({
    queryKey: ["permissions", user?.id],
    queryFn: async (): Promise<{ profile: UserPermissionProfile | null; map: PermissionMap }> => {
      if (!user) return { profile: null, map: {} };

      // 1. Get user profile and linked permission profile
      const { data: profileData, error: profileErr } = await supabase
        .from("profiles")
        .select(`
          permission_profile_id,
          permission_profiles (
            id,
            name,
            is_system,
            active
          )
        `)
        .eq("id", user.id)
        .maybeSingle();

      if (profileErr || !profileData?.permission_profiles) {
        return { profile: null, map: {} };
      }

      const permissionProfile = profileData.permission_profiles as unknown as UserPermissionProfile;
      
      if (!permissionProfile.active) {
        return { profile: permissionProfile, map: {} };
      }

      // 2. Load rules for this profile
      const { data: rules, error: rulesErr } = await supabase
        .from("permission_profile_rules")
        .select(`
          can_view,
          can_create,
          can_edit,
          can_delete,
          permission_resources (
            key
          )
        `)
        .eq("profile_id", permissionProfile.id);

      if (rulesErr || !rules) {
        return { profile: permissionProfile, map: {} };
      }

      // 3. Map to technical keys
      const map: PermissionMap = {};
      rules.forEach((rule: any) => {
        const resourceKey = rule.permission_resources?.key;
        if (resourceKey) {
          map[resourceKey] = {
            view: rule.can_view,
            create: rule.can_create,
            edit: rule.can_edit,
            delete: rule.can_delete,
          };
        }
      });

      return { profile: permissionProfile, map };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const can = (resource: string, action: PermissionAction): boolean => {
    if (isLoading || !permissions?.map) return false;
    const flags = permissions.map[resource];
    return flags ? flags[action] : false;
  };

  return {
    can,
    permissions: permissions?.map ?? {},
    profile: permissions?.profile ?? null,
    isLoading,
    error,
  };
}
