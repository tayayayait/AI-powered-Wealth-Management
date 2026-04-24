export interface DemoAutoLoginState {
  pathname: string;
  search: string;
  authLoading: boolean;
  isAuthenticated: boolean;
  autoLoginAttempted: boolean;
}

const DEMO_AUTO_LOGIN_CREDENTIALS = {
  email: "dbcdkwo629@naver.com",
  password: "12341234",
} as const;

export function getDemoAutoLoginCredentials() {
  return DEMO_AUTO_LOGIN_CREDENTIALS;
}

export function shouldRunDemoAutoLogin({
  pathname,
  search,
  authLoading,
  isAuthenticated,
  autoLoginAttempted,
}: DemoAutoLoginState) {
  if (authLoading || isAuthenticated || autoLoginAttempted) return false;
  if (pathname !== "/login") return false;

  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  return params.get("manual") !== "1";
}
