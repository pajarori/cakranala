import { createRouter } from "@tanstack/react-router";
import { rootRoute, shellRoute } from "@/routes/root";
import { situationRoute } from "@/routes/situation";
import { threatsRoute } from "@/routes/threats";
import { threatRoute, threatTabs } from "@/routes/threat";
import { monitorsRoute, newMonitorRoute } from "@/routes/monitors";
import { reportRoute, reportsRoute } from "@/routes/reports";
import { perisaiRoute } from "@/routes/perisai";
import { systemRoute } from "@/routes/system";
import { loginRoute } from "@/routes/login";
import { newUserRoute, passwordRoute, usersRoute } from "@/routes/users";
import { credentialsRoute, newCredentialRoute } from "@/routes/credentials";
import { actorRoute, actorsRoute, watchlistRoute } from "@/routes/actors";

const routeTree = shellRoute.addChildren([loginRoute, rootRoute.addChildren([situationRoute, threatsRoute, threatRoute.addChildren(threatTabs), actorsRoute, watchlistRoute, actorRoute, monitorsRoute, newMonitorRoute, reportsRoute, reportRoute, perisaiRoute, systemRoute, usersRoute, newUserRoute, passwordRoute, credentialsRoute, newCredentialRoute])]);

export const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
