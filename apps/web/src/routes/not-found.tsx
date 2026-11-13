import { Link } from "@tanstack/react-router";
import { EmptyState, PageHeader } from "@/components/primitives";

export function NotFound() {
  return (
    <>
      <PageHeader title="Not found" />
      <EmptyState title="This page does not exist." action={<Link to="/" className="text-[13px] text-fg-2 underline underline-offset-2">Go to overview</Link>} />
    </>
  );
}
