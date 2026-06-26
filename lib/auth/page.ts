import { headers } from "next/headers";
import { readPageIdentity, type VisitorIdentity } from "./passport";

export async function currentPageVisitor(): Promise<VisitorIdentity | null> {
  return readPageIdentity(await headers());
}
