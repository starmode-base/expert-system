import { describe, expect, test } from "vitest";
import { DEV_CLERK_USER_ID, assertDevUser, isDevUser } from "./dev-user";

describe("dev user authorization", () => {
  test("recognizes the configured system curator", () => {
    expect(isDevUser(DEV_CLERK_USER_ID)).toBe(true);
    expect(() => {
      assertDevUser(DEV_CLERK_USER_ID);
    }).not.toThrow();
  });

  test("rejects every other authenticated user", () => {
    expect(isDevUser("user_someone_else")).toBe(false);
    expect(() => {
      assertDevUser("user_someone_else");
    }).toThrow("Unauthorized");
  });

  test("rejects unauthenticated requests", () => {
    expect(isDevUser(null)).toBe(false);
    expect(() => {
      assertDevUser(undefined);
    }).toThrow("Unauthorized");
  });
});
