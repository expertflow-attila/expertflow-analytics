import { customAlphabet } from "nanoid";
import { text } from "drizzle-orm/pg-core";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const generate = customAlphabet(alphabet, 21);

/** Prefixed, URL-safe, sortable-enough public identifier (e.g. `org_a3f…`). */
export function newId(prefix: string): string {
  return `${prefix}_${generate()}`;
}

/**
 * Primary key column with an application-generated prefixed id.
 * Prefixed ids make logs, support tickets and IDOR review far easier than
 * bare UUIDs — you can always tell what kind of thing an id refers to.
 */
export function id(prefix: string) {
  return text("id")
    .primaryKey()
    .$defaultFn(() => newId(prefix));
}
