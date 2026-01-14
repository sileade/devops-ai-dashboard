import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("auth.me", () => {
  it("returns user when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Test User");
    expect(result?.email).toBe("test@example.com");
  });

  it("returns null when not authenticated", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();

    expect(result).toBeNull();
  });
});

describe("dashboard router", () => {
  it("getOverview returns infrastructure stats for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getOverview();

    expect(result).toBeDefined();
    expect(result.containers).toBeDefined();
    expect(result.containers.total).toBeGreaterThanOrEqual(0);
    expect(result.kubernetes).toBeDefined();
    expect(result.kubernetes.pods).toBeGreaterThanOrEqual(0);
    expect(result.deployments).toBeDefined();
    expect(result.alerts).toBeDefined();
  });

  it("getRecentActivity returns activity list", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getRecentActivity();

    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it("getResourceUsage returns resource metrics", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.dashboard.getResourceUsage();

    expect(result).toBeDefined();
    expect(result.cpu).toBeDefined();
    expect(result.memory).toBeDefined();
    expect(result.storage).toBeDefined();
  });
});
