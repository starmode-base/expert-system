import { z } from "zod";

/**
 * Id schema
 */
export const Id = z.string().length(24);
export type Id = z.infer<typeof Id>;

/**
 * Email address schema
 */
export const EmailAddress = z.email();
export type EmailAddress = z.infer<typeof EmailAddress>;
