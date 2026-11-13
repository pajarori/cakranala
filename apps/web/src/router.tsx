import { createRouter } from "@tanstack/react-router";
import { rootRoute } from "@/routes/root";
import { situationRoute } from "@/routes/situation";
import { threatsRoute } from "@/routes/threats";
import { threatRoute, threatTabs } from "@/routes/threat";
import { monitorsRoute, newMonitorRoute } from "@/routes/monitors";
import { reportRoute, reportsRoute } from "@/routes/reports";
import { perisaiRoute } from "@/routes/perisai";
import { systemRoute } from "@/routes/system";
import { operatorRoute } from "@/routes/operator";
import { credentialsRoute, newCredentialRoute } from "@/routes/credentials";

const routeTree = rootRoute.addChildren([situationRoute, threatsRoute, threatRoute.addChildren(threatTabs), monitorsRoute, newMonitorRoute, reportsRoute, reportRoute, perisaiRoute, systemRoute, operatorRoute, credentialsRoute, newCredentialRoute]);

export const router = createRouter({ routeTree, defaultPreload: "intent", scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
