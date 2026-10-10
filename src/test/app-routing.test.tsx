import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { Route as IndexRoute } from "@/routes/index";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("does not redirect / to login via beforeLoad", () => {
    // Unauthenticated visitors should be able to view the landing page directly
    expect(IndexRoute.options.beforeLoad).toBeUndefined();
    expect(IndexRoute.options.component).toBeDefined();
  });

  it("matches destination routes for User and Admin entry points", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const userMatches = router.matchRoutes("/login");
    expect(userMatches.at(-1)?.routeId).toBe("/login");

    const adminMatches = router.matchRoutes("/admin-login");
    expect(adminMatches.at(-1)?.routeId).toBe("/admin-login");
  });
});

