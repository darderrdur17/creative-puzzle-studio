/** sessionStorage key: anonymous user id to migrate best-ideas from after email link sign-in */
export const PENDING_BEST_IDEAS_MIGRATE_KEY = "puzzle-pending-best-ideas-from";

export function stashPendingBestIdeasMigration(priorUserId: string | null) {
  if (priorUserId) {
    sessionStorage.setItem(PENDING_BEST_IDEAS_MIGRATE_KEY, priorUserId);
  }
}

export function clearPendingBestIdeasMigration() {
  sessionStorage.removeItem(PENDING_BEST_IDEAS_MIGRATE_KEY);
}
