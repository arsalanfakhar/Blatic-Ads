import { prisma } from './prisma';
import { createSupabaseServerClient } from './supabase/server';

export interface AuthUser {
  id: string;
  username: string;
  fullName: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user?.email) return null;

    const user = await prisma.user.findFirst({
      where: { email: session.user.email, isDeleted: false },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        status: true,
        userRoles: {
          select: {
            role: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
    if (!user || user.status !== 'Active') return null;

    const roles = user.userRoles.map((ur) => ur.role.name);
    const roleIds = user.userRoles.map((ur) => ur.role.id);

    const rolePermissions =
      roleIds.length > 0
        ? await prisma.rolePermission.findMany({
            where: { roleId: { in: roleIds } },
            select: { permission: { select: { module: true, action: true } } },
          })
        : [];

    const permissions = rolePermissions.map(
      (rp) => `${rp.permission.module}:${rp.permission.action.toLowerCase()}`
    );

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      roles,
      permissions,
    };
  } catch {
    return null;
  }
}

export function hasPermission(
  user: AuthUser | null,
  module: string,
  action: string
): boolean {
  if (!user) return false;
  if (user.roles.includes('Admin')) return true;
  return user.permissions.some((p) => {
    const [m, a] = p.split(':');
    return m === module && a.startsWith(action.toLowerCase());
  });
}

export function hasModuleAccess(user: AuthUser | null, module: string): boolean {
  if (!user) return false;
  if (user.roles.includes('Admin')) return true;
  const prefix = `${module}:`;
  return user.permissions.some((p) => p.startsWith(prefix));
}
