const KAIST_EMAIL_REGEX = /^[^\s@]+@kaist\.ac\.kr$/i;

export function isKaistEmail(email: string) {
  return KAIST_EMAIL_REGEX.test(email.trim());
}

export function isStrongEnoughPassword(password: string) {
  // MVP rule: at least 8 characters. We keep this conservative on the client
  // and rely on the backend for the authoritative policy.
  return password.length >= 8;
}
