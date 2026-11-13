import { createRootRoute } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { EmptyState, PageSkeleton } from "@/components/primitives";
import { Link } from "@tanstack/react-router";

declare module "@tanstack/react-router" {
  interface StaticDataRouteOption {
    title?: string;
  }
}

export const rootRoute = createRootRoute({
  component: Shell,
  pendingComponent: PageSkeleton,
  notFoundComponent: () => (
    <EmptyState
      title="Not found"
      action={
        <Link to="/" className="text-[15px] underline underline-offset-4">
          Back to overview
        </Link>
      }
    />
  ),
});
