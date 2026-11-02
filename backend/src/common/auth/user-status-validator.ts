export abstract class UserStatusValidator {
  assertSession?(payload: import('./current-actor.interface').JwtPayload): Promise<void>;
  /**
   * Asserts that the user is not locked or invalid.
   * If user is locked, invalidates sessions and throws ForbiddenAppException.
   */
  abstract assertUserActive(userId: string): Promise<void>;
}
