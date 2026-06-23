export const DEV_CLERK_USER_ID = "user_2ujqJX9ueMg9wBJVUVATq8veKI3";

export function isDevUser(clerkUserId: string | null | undefined): boolean {
  return clerkUserId === DEV_CLERK_USER_ID;
}

export function assertDevUser(
  clerkUserId: string | null | undefined,
): asserts clerkUserId is string {
  if (!isDevUser(clerkUserId)) {
    throw new Error("Unauthorized");
  }
}
