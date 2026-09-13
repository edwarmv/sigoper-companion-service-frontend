import { createRoute, createRouter } from "@tanstack/react-router";
import App from "./App";
import { rootRoute } from "./root-route";

export const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/$roomId",
  component: App,
});

const routeTree = rootRoute.addChildren([appRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
