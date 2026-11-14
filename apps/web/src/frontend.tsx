import { StrictMode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queries";
import { router } from "@/router";

const app = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>
);

type HotData = { root?: Root };
const hotData = import.meta.hot?.data as HotData | undefined;
const root = hotData?.root ?? createRoot(document.getElementById("root")!);
if (hotData) hotData.root = root;
root.render(app);
