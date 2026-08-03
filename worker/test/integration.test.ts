import { env, SELF } from "cloudflare:test";
import migrationSql from "../migrations/0001_initial.sql?raw";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { MAX_IMAGE_BYTES } from "../src/shared";
import { JPEG } from "./fixture";

const firebaseUsers = new Map<
  string,
  { localId: string; password: string; idToken: string; emailVerified: boolean }
>();
const firebaseTokens = new Map<string, string>();
let verificationEmail = "";
let resetEmail = "";
function firebaseResponse(status: number, value: unknown) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("Worker lifecycle (workerd + local D1)", () => {
  beforeAll(async () => {
    for (const query of migrationSql
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean))
      await env.DB.exec(query.replace(/\s+/g, " "));
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (!url.includes("identitytoolkit.googleapis.com"))
          return firebaseResponse(404, { error: { message: "NOT_FOUND" } });
        const endpoint = new URL(url).pathname.split("/").at(-1);
        const payload = init?.body ? JSON.parse(String(init.body)) : {};
        if (endpoint === "accounts:signUp") {
          const email = String(payload.email).toLowerCase();
          if (firebaseUsers.has(email))
            return firebaseResponse(400, {
              error: { message: "EMAIL_EXISTS" },
            });
          const localId = `firebase-${crypto.randomUUID()}`;
          const idToken = `id-token-${localId}`;
          firebaseUsers.set(email, {
            localId,
            password: payload.password,
            idToken,
            emailVerified: false,
          });
          firebaseTokens.set(idToken, email);
          return firebaseResponse(200, { localId, idToken });
        }
        if (endpoint === "accounts:signInWithPassword") {
          const email = String(payload.email).toLowerCase();
          const user = firebaseUsers.get(email);
          if (!user || user.password !== payload.password)
            return firebaseResponse(400, {
              error: { message: "INVALID_LOGIN_CREDENTIALS" },
            });
          return firebaseResponse(200, {
            localId: user.localId,
            idToken: user.idToken,
          });
        }
        if (endpoint === "accounts:lookup") {
          const email = firebaseTokens.get(String(payload.idToken));
          const user = email && firebaseUsers.get(email);
          if (!user)
            return firebaseResponse(400, {
              error: { message: "INVALID_ID_TOKEN" },
            });
          return firebaseResponse(200, {
            users: [
              {
                localId: user.localId,
                email,
                emailVerified: user.emailVerified,
              },
            ],
          });
        }
        if (endpoint === "accounts:sendOobCode") {
          if (payload.requestType === "VERIFY_EMAIL") {
            const email = firebaseTokens.get(String(payload.idToken));
            const user = email && firebaseUsers.get(email);
            if (!user)
              return firebaseResponse(400, {
                error: { message: "INVALID_ID_TOKEN" },
              });
            verificationEmail = email!;
          } else if (payload.requestType === "PASSWORD_RESET") {
            resetEmail = String(payload.email).toLowerCase();
          }
          return firebaseResponse(200, {});
        }
        if (
          endpoint === "accounts:update" &&
          payload.oobCode === "verify-code"
        ) {
          const user = firebaseUsers.get(verificationEmail);
          if (!user)
            return firebaseResponse(400, {
              error: { message: "INVALID_OOB_CODE" },
            });
          user.emailVerified = true;
          return firebaseResponse(200, {
            localId: user.localId,
            email: verificationEmail,
          });
        }
        if (
          endpoint === "accounts:resetPassword" &&
          payload.oobCode === "reset-code"
        ) {
          const user = firebaseUsers.get(resetEmail);
          if (!user)
            return firebaseResponse(400, {
              error: { message: "INVALID_OOB_CODE" },
            });
          user.password = String(payload.newPassword);
          return firebaseResponse(200, {
            email: resetEmail,
            requestType: "PASSWORD_RESET",
          });
        }
        if (endpoint === "accounts:delete") {
          const email = firebaseTokens.get(String(payload.idToken));
          if (email) firebaseUsers.delete(email);
          return firebaseResponse(200, {});
        }
        return firebaseResponse(404, { error: { message: "NOT_FOUND" } });
      }),
    );
  });
  afterAll(() => vi.unstubAllGlobals());
  it("supports Firebase auth, sessions, routes, and moderation against local bindings", async () => {
    const health = await SELF.fetch("https://routemaker.test/api/health");
    expect(await health.json()).toEqual({ status: "ok" });

    const email = `worker-${crypto.randomUUID()}@example.com`;
    const signup = await SELF.fetch("https://routemaker.test/api/auth/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email,
        username: `u${crypto.randomUUID().slice(0, 8)}`,
        display_name: "Worker",
        password: "climb1234",
      }),
    });
    const signupPayload = await signup.json<any>();
    expect(signup.status).toBe(201);
    expect(signupPayload.message).toContain("verify");
    const unverified = await SELF.fetch(
      "https://routemaker.test/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "climb1234" }),
      },
    );
    expect(unverified.status).toBe(403);
    const wrongPassword = await SELF.fetch(
      "https://routemaker.test/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password: "wrong-password" }),
      },
    );
    expect(wrongPassword.status).toBe(401);
    const verification = await SELF.fetch(
      "https://routemaker.test/api/auth/verify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oob_code: "verify-code" }),
      },
    );
    expect(verification.status).toBe(200);
    const login = await SELF.fetch("https://routemaker.test/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password: "climb1234" }),
    });
    expect(login.status).toBe(200);
    const session = await login.json<any>();
    expect(
      (
        await SELF.fetch("https://routemaker.test/api/me", {
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).status,
    ).toBe(200);
    const profile = await SELF.fetch("https://routemaker.test/api/me", {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${session.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ display_name: "Updated Worker" }),
    });
    expect(profile.status).toBe(200);
    expect((await profile.json<any>()).display_name).toBe("Updated Worker");
    const form = new FormData();
    form.set("name", "Integration Arete");
    form.set("gym_id", "boulder-plus");
    form.set("owner_grade", "V4");
    form.set(
      "image",
      new File([JPEG], "wall.jpg", {
        type: "image/jpeg",
      }),
    );
    const routeResponse = await SELF.fetch(
      "https://routemaker.test/api/routes",
      {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}` },
        body: form,
      },
    );
    expect(routeResponse.status).toBe(201);
    const route = await routeResponse.json<any>();
    const routeImage = await SELF.fetch(
      `https://routemaker.test${route.image_url}`,
    );
    expect(routeImage.status).toBe(200);
    expect(new Uint8Array(await routeImage.arrayBuffer())).toEqual(JPEG);
    expect(
      (
        await SELF.fetch(
          `https://routemaker.test/api/routes/${route.id}/vote`,
          {
            method: "POST",
            headers: {
              authorization: `Bearer ${session.token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ active: true }),
          },
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await SELF.fetch(
          `https://routemaker.test/api/routes/${route.id}/grade`,
          {
            method: "PUT",
            headers: {
              authorization: `Bearer ${session.token}`,
              "content-type": "application/json",
            },
            body: JSON.stringify({ grade: "V5" }),
          },
        )
      ).status,
    ).toBe(200);
    const comment = await SELF.fetch(
      `https://routemaker.test/api/routes/${route.id}/comments`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ body: "Powerful finish" }),
      },
    );
    expect(comment.status).toBe(201);
    expect(await comment.json()).toMatchObject({
      body: "Powerful finish",
      author: { username: session.user.username },
    });
    await env.DB.prepare("UPDATE users SET role='admin' WHERE id=?")
      .bind(session.user.id)
      .run();
    const selfDisable = await SELF.fetch(
      `https://routemaker.test/api/admin/users/${session.user.id}/disabled?disabled=true`,
      {
        method: "PUT",
        headers: { authorization: `Bearer ${session.token}` },
      },
    );
    expect(selfDisable.status).toBe(409);
    const report = await SELF.fetch("https://routemaker.test/api/reports", {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        target_type: "route",
        target_id: route.id,
        reason: "Integration moderation",
      }),
    });
    expect(report.status).toBe(201);
    const reportId = (await report.json<any>()).id;
    const moderation = await SELF.fetch(
      `https://routemaker.test/api/admin/reports/${reportId}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ decision: "hide" }),
      },
    );
    expect(moderation.status).toBe(200);
    const staleModeration = await SELF.fetch(
      `https://routemaker.test/api/admin/reports/${reportId}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ decision: "hide" }),
      },
    );
    expect(staleModeration.status).toBe(409);
    expect(
      await env.DB.prepare("SELECT image FROM routes WHERE id=?")
        .bind(route.id)
        .first("image"),
    ).toBeNull();
    const invalidForm = new FormData();
    invalidForm.set("name", "Invalid");
    invalidForm.set("gym_id", "boulder-plus");
    invalidForm.set("owner_grade", "V4");
    invalidForm.set(
      "image",
      new File([new Uint8Array([1, 2, 3])], "not.jpg", { type: "image/jpeg" }),
    );
    const invalidUpload = await SELF.fetch(
      "https://routemaker.test/api/routes",
      {
        method: "POST",
        headers: { authorization: `Bearer ${session.token}` },
        body: invalidForm,
      },
    );
    expect(invalidUpload.status).toBe(415);
    const oversizedJpeg = new Uint8Array(MAX_IMAGE_BYTES + 1);
    oversizedJpeg.set(JPEG.subarray(0, -2));
    oversizedJpeg.set([0xff, 0xd9], oversizedJpeg.length - 2);
    const oversizedForm = new FormData();
    oversizedForm.set("name", "Too large");
    oversizedForm.set("gym_id", "boulder-plus");
    oversizedForm.set("owner_grade", "V4");
    oversizedForm.set(
      "image",
      new File([oversizedJpeg], "large.jpg", { type: "image/jpeg" }),
    );
    expect(
      (
        await SELF.fetch("https://routemaker.test/api/routes", {
          method: "POST",
          headers: { authorization: `Bearer ${session.token}` },
          body: oversizedForm,
        })
      ).status,
    ).toBe(413);
    for (let i = 0; i < 2; i++) {
      const quotaForm = new FormData();
      quotaForm.set("name", `Quota ${i}`);
      quotaForm.set("gym_id", "boulder-plus");
      quotaForm.set("owner_grade", "V4");
      quotaForm.set(
        "image",
        new File([JPEG], "wall.jpg", {
          type: "image/jpeg",
        }),
      );
      expect(
        (
          await SELF.fetch("https://routemaker.test/api/routes", {
            method: "POST",
            headers: { authorization: `Bearer ${session.token}` },
            body: quotaForm,
          })
        ).status,
      ).toBe(201);
    }
    const overQuota = new FormData();
    overQuota.set("name", "Quota overflow");
    overQuota.set("gym_id", "boulder-plus");
    overQuota.set("owner_grade", "V4");
    overQuota.set(
      "image",
      new File([JPEG], "wall.jpg", {
        type: "image/jpeg",
      }),
    );
    expect(
      (
        await SELF.fetch("https://routemaker.test/api/routes", {
          method: "POST",
          headers: { authorization: `Bearer ${session.token}` },
          body: overQuota,
        })
      ).status,
    ).toBe(429);
    const secondEmail = `worker-${crypto.randomUUID()}@example.com`;
    const secondSignup = await SELF.fetch(
      "https://routemaker.test/api/auth/signup",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: secondEmail,
          username: `u${crypto.randomUUID().slice(0, 8)}`,
          display_name: "Reported",
          password: "climb1234",
        }),
      },
    );
    expect(secondSignup.status).toBe(201);
    firebaseUsers.get(secondEmail)!.emailVerified = true;
    const secondLogin = await SELF.fetch(
      "https://routemaker.test/api/auth/login",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: secondEmail, password: "climb1234" }),
      },
    );
    const secondSession = await secondLogin.json<any>();
    const secondForm = new FormData();
    secondForm.set("name", "Reported Route");
    secondForm.set("gym_id", "boulder-plus");
    secondForm.set("owner_grade", "V3");
    secondForm.set(
      "image",
      new File([JPEG], "reported.jpg", { type: "image/jpeg" }),
    );
    const secondRouteResponse = await SELF.fetch(
      "https://routemaker.test/api/routes",
      {
        method: "POST",
        headers: { authorization: `Bearer ${secondSession.token}` },
        body: secondForm,
      },
    );
    expect(secondRouteResponse.status).toBe(201);
    const secondRoute = await secondRouteResponse.json<any>();
    const userReport = await SELF.fetch("https://routemaker.test/api/reports", {
      method: "POST",
      headers: {
        authorization: `Bearer ${session.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        target_type: "user",
        target_id: secondSession.user.id,
        reason: "Integration user moderation",
      }),
    });
    expect(userReport.status).toBe(201);
    const userReportId = (await userReport.json<any>()).id;
    const userModeration = await SELF.fetch(
      `https://routemaker.test/api/admin/reports/${userReportId}`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${session.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ decision: "hide" }),
      },
    );
    expect(userModeration.status).toBe(200);
    expect(
      (
        await SELF.fetch("https://routemaker.test/api/me", {
          headers: { authorization: `Bearer ${secondSession.token}` },
        })
      ).status,
    ).toBe(401);
    const blockedMutation = await SELF.fetch(
      `https://routemaker.test/api/routes/${route.id}/vote`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${secondSession.token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ active: true }),
      },
    );
    expect(blockedMutation.status).toBe(401);
    expect(
      await env.DB.prepare("SELECT image FROM routes WHERE id=?")
        .bind(secondRoute.id)
        .first("image"),
    ).toBeNull();
    expect(
      (
        await SELF.fetch(
          `https://routemaker.test/api/admin/users/${secondSession.user.id}/disabled?disabled=false`,
          {
            method: "PUT",
            headers: { authorization: `Bearer ${session.token}` },
          },
        )
      ).status,
    ).toBe(200);
    expect(
      (await SELF.fetch(`https://routemaker.test/api/routes/${secondRoute.id}`))
        .status,
    ).toBe(404);
    const blockedDelete = await SELF.fetch("https://routemaker.test/api/me", {
      method: "DELETE",
      headers: { authorization: `Bearer ${session.token}` },
    });
    expect(blockedDelete.status).toBe(404);
    expect(
      (
        await SELF.fetch("https://routemaker.test/api/me", {
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).status,
    ).toBe(200);
    const forgot = await SELF.fetch("https://routemaker.test/api/auth/forgot", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
    expect(forgot.status).toBe(200);
    expect(
      (
        await SELF.fetch("https://routemaker.test/api/me", {
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).status,
    ).toBe(200);
    const reset = await SELF.fetch("https://routemaker.test/api/auth/reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        oob_code: "reset-code",
        password: "new-climb-1234",
      }),
    });
    expect(reset.status).toBe(200);
    expect(
      (
        await SELF.fetch("https://routemaker.test/api/me", {
          headers: { authorization: `Bearer ${session.token}` },
        })
      ).status,
    ).toBe(401);
    expect(env.DB).toBeDefined();
  });
});
