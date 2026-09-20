import { describe, expect, test, vi, afterEach } from "vitest";
import { assertDevUser, isDevUser } from "./dev-user";

const DEV_AUTH0_SUBJECT = "auth0|curator";
afterEach(() => vi.unstubAllEnvs());
describe("dev user authorization", () => {
  test("recognizes the configured system curator", () => {
    vi.stubEnv("DEV_AUTH0_SUBJECT", DEV_AUTH0_SUBJECT);
    expect(isDevUser(DEV_AUTH0_SUBJECT)).toBe(true);
    expect(() => {
      assertDevUser(DEV_AUTH0_SUBJECT);
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
