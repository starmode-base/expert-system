import { customAlphabet } from "nanoid";

const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const lowercase = "abcdefghijklmnopqrstuvwxyz";
const numbers = "0123456789";
const alphanumeric = numbers + lowercase + uppercase;

/**
 * Generates a random alphanumeric string of length 24. Takes an optional size
 * parameter to generate a random string of a different length.
 */
export const randomId = customAlphabet(alphanumeric, 24);
