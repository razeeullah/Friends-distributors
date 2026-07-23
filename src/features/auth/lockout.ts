export interface LoginFailureState {
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  accountLocked: boolean;
}

export function getNextLoginFailureState(
  currentFailedAttempts: number,
  now: Date,
  lockoutAttempts: number,
  lockoutMinutes: number,
): LoginFailureState {
  const nextFailedAttempts = currentFailedAttempts + 1;
  if (nextFailedAttempts < lockoutAttempts) {
    return {
      failedLoginAttempts: nextFailedAttempts,
      lockedUntil: null,
      accountLocked: false,
    };
  }

  return {
    failedLoginAttempts: 0,
    lockedUntil: new Date(now.getTime() + lockoutMinutes * 60 * 1000),
    accountLocked: true,
  };
}
