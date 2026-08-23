export const RESET_NEXT_KEY = "legendary-events-reset-next";

export function resetPasswordPath() {
  return "/reset-password";
}

export function forgotPasswordHref(email?: string, next?: string) {
  const params = new URLSearchParams();
  if (email) params.set("email", email);
  if (next && next !== "/") params.set("next", next);
  const query = params.toString();
  return query ? `/forgot-password?${query}` : "/forgot-password";
}
