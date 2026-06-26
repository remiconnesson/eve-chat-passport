import type { AuthFn } from "eve/channels/auth";
import { readVercelPassportIdentity } from "./passport";

type VisitorPrincipal = Exclude<
  Awaited<ReturnType<AuthFn<Request>>>,
  null | undefined
>;

export function passportAuth(): AuthFn<Request> {
  return async (request): Promise<VisitorPrincipal | null> => {
    const identity = readVercelPassportIdentity(request.headers);
    if (!identity) return null;

    return {
      attributes: {
        ...(identity.email ? { email: identity.email } : {}),
        ...(identity.name ? { name: identity.name } : {}),
      },
      authenticator: identity.authenticator,
      principalId: identity.id,
      principalType: "user",
    };
  };
}
