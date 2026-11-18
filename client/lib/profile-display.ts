/**
 * Display helpers for accounts without an avatar upload yet. Chunk 10 adds
 * pictures; until then every member is drawn with initials from their chosen
 * display name, falling back to a neutral label rather than the email address
 * (which is private).
 */
export const FALLBACK_DISPLAY_NAME = "Marketplace member";

export function displayNameOf(user: { displayName: string }): string {
  return user.displayName.trim() || FALLBACK_DISPLAY_NAME;
}

/**
 * One or two initials: first letter of the first and last word. Uses code
 * points, not UTF-16 units, so an emoji or an accented letter is never cut in
 * half.
 */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return "M";
  }

  const first = Array.from(words[0]!)[0] ?? "";
  const last =
    words.length > 1 ? (Array.from(words[words.length - 1]!)[0] ?? "") : "";

  return `${first}${last}`.toUpperCase();
}

export function initialsForUser(user: { displayName: string }): string {
  const name = user.displayName.trim();

  return name ? initialsOf(name) : "M";
}
