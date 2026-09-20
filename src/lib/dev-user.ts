export function isDevUser(subject: string | null | undefined): boolean {
  return (
    !!process.env.DEV_AUTH0_SUBJECT && subject === process.env.DEV_AUTH0_SUBJECT
  );
}
export function assertDevUser(
  subject: string | null | undefined,
): asserts subject is string {
  if (!isDevUser(subject)) throw new Error("Unauthorized");
}
