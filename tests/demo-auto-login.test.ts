import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getDemoAutoLoginCredentials,
  shouldRunDemoAutoLogin,
} from "../src/lib/demo-auto-login.ts";

test("provides the client demo login credentials", () => {
  assert.deepEqual(getDemoAutoLoginCredentials(), {
    email: "dbcdkwo629@naver.com",
    password: "12341234",
  });
});

test("runs demo auto login only on an unauthenticated ready login page", () => {
  assert.equal(
    shouldRunDemoAutoLogin({
      pathname: "/login",
      search: "",
      authLoading: false,
      isAuthenticated: false,
      autoLoginAttempted: false,
    }),
    true,
  );

  assert.equal(
    shouldRunDemoAutoLogin({
      pathname: "/login",
      search: "",
      authLoading: true,
      isAuthenticated: false,
      autoLoginAttempted: false,
    }),
    false,
  );

  assert.equal(
    shouldRunDemoAutoLogin({
      pathname: "/login",
      search: "?manual=1",
      authLoading: false,
      isAuthenticated: false,
      autoLoginAttempted: false,
    }),
    false,
  );
});
