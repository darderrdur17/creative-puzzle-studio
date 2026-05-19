export const AUTH_ROLE_KEY = "role";

export type AuthRole = "teacher" | "student";

export function getAuthRole(metadata: Record<string, unknown> | undefined): AuthRole | null {
  const role = metadata?.[AUTH_ROLE_KEY];
  if (role === "teacher" || role === "student") return role;
  return null;
}

export function isStudentUser(metadata: Record<string, unknown> | undefined): boolean {
  return getAuthRole(metadata) === "student";
}

export function isTeacherUser(
  user: { is_anonymous?: boolean; user_metadata?: Record<string, unknown> } | null | undefined,
): boolean {
  if (!user || user.is_anonymous) return false;
  const role = getAuthRole(user.user_metadata);
  return role !== "student";
}
