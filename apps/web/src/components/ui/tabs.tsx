"use client";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import NumberFlow from "@number-flow/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, use, useEffect, useRef } from "react";
import { cn } from "@/lib/cn";
import { spring } from "@/lib/motion";

type Variant = "underline" | "pill";
type Size = "sm" | "md";
const TabsContext = createContext<{ variant: Variant; size: Size }>({ variant: "underline", size: "md" });

const FADE = 28;

export function useOverflowEdges(ref: React.RefObject<HTMLElement | null>, fade = FADE) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = Math.abs(el.scrollLeft);
        const max = el.scrollWidth - el.clientWidth;
        const start = x > 1;
        const end = max - x > 1;
        el.style.setProperty("--fade-start", start ? `${fade}px` : "0px");
        el.style.setProperty("--fade-end", end ? `${fade}px` : "0px");
        el.toggleAttribute("data-overflow-start", start);
        el.toggleAttribute("data-overflow-end", end);
      });
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    for (const child of el.children) ro.observe(child);
    const mo = new MutationObserver(() => {
      for (const child of el.children) ro.observe(child);
      update();
    });
    mo.observe(el, { childList: true });
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("scroll", update);
      ro.disconnect();
      mo.disconnect();
    };
  }, [ref, fade]);
}
function revealActive(list: HTMLElement, smooth: boolean) {
  const tab = list.querySelector<HTMLElement>("[role=tab][data-active]");
  if (!tab || list.scrollWidth <= list.clientWidth) return;
  const left = tab.offsetLeft - FADE;
  const right = tab.offsetLeft + tab.offsetWidth + FADE - list.clientWidth;
  const target = list.scrollLeft > left ? left : list.scrollLeft < right ? right : null;
  if (target !== null) list.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
}
export type TabsProps = Omit<BaseTabs.Root.Props, "className" | "orientation"> & {
  variant?: Variant;
  size?: Size;
  className?: string;
};
export function Tabs({ variant = "underline", size = "md", className, onKeyDownCapture, onPointerDownCapture, ...rest }: TabsProps) {
  return (
    <TabsContext value={{ variant, size }}>
      <BaseTabs.Root
        data-tabs-root=""
        data-variant={variant}
        data-size={size}
        onKeyDownCapture={(e) => {
          e.currentTarget.dataset.nav = "key";
          onKeyDownCapture?.(e);
        }}
        onPointerDownCapture={(e) => {
          e.currentTarget.dataset.nav = "pointer";
          onPointerDownCapture?.(e);
        }}
        className={cn("group/tabs flex min-w-0 flex-col", className)}
        {...rest}
      />
    </TabsContext>
  );
}
export type TabsListProps = Omit<BaseTabs.List.Props, "className"> & {
  className?: string;

  wrapperClassName?: string;
};
export function TabsList({ className, wrapperClassName, children, activateOnFocus = true, ...rest }: TabsListProps) {
  const { variant, size } = use(TabsContext);
  const ref = useRef<HTMLDivElement>(null);
  useOverflowEdges(ref);
  useEffect(() => {
    const list = ref.current;
    if (!list) return;
    revealActive(list, false);
    const mo = new MutationObserver(() => {
      const root = list.closest<HTMLElement>("[data-tabs-root]");
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      revealActive(list, root?.dataset.nav !== "key" && !reduce);
    });
    mo.observe(list, { subtree: true, attributeFilter: ["data-active"] });
    return () => mo.disconnect();
  }, []);
  const underline = variant === "underline";
  return (
    <div
      className={cn(
        "relative min-w-0",
        underline && "before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-px before:bg-line",
        wrapperClassName,
      )}
    >
      <BaseTabs.List
        ref={ref}
        activateOnFocus={activateOnFocus}
        className={cn(
          "relative flex min-w-0 items-center overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          "[mask-image:linear-gradient(to_right,transparent,var(--fg)_var(--fade-start,0px),var(--fg)_calc(100%-var(--fade-end,0px)),transparent)]",
          "scroll-px-7",
          underline ? "gap-1" : "gap-0.5 pointer-coarse:-my-2 pointer-coarse:py-2",
          className,
        )}
        {...rest}
      >
        {children}
        <BaseTabs.Indicator
          className={cn(
            "pointer-events-none absolute left-0 translate-x-(--active-tab-left)",
            "transition-[translate,width] duration-[240ms] ease-in-out-quart group-data-[nav=key]/tabs:duration-0",
            underline
              ?
                cn("bottom-0 z-10 h-0.5 rounded-full bg-fg", size === "sm" ? "ml-1.5 w-[calc(var(--active-tab-width)-12px)]" : "ml-2 w-[calc(var(--active-tab-width)-16px)]")
              : cn(
                  "top-(--active-tab-top) -z-10 h-(--active-tab-height) w-(--active-tab-width) bg-fg/[0.075] ring-1 ring-inset ring-fg/[0.04]",
                  size === "sm" ? "rounded-md" : "rounded-lg",
                ),
          )}
        />
      </BaseTabs.List>
    </div>
  );
}
export type TabsTabProps = Omit<BaseTabs.Tab.Props, "className" | "children"> & {
  className?: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  count?: number;
  dot?: boolean;
};
export function TabsTab({ icon, count, dot = false, children, className, ...rest }: TabsTabProps) {
  const { variant, size } = use(TabsContext);
  const reduce = useReducedMotion();
  const underline = variant === "underline";
  const sm = size === "sm";
  return (
    <BaseTabs.Tab
      className={cn(
        "group/tab relative flex shrink-0 select-none items-center outline-none",
        "touch-manipulation [-webkit-tap-highlight-color:transparent]",
        "font-medium tracking-[-0.005em] text-fg-3 transition-colors duration-150 hover:text-fg-2 data-active:text-fg",
        "data-disabled:pointer-events-none data-disabled:text-fg-4",
        underline ? (sm ? "h-9 px-1.5 text-[12.5px]" : "h-10 px-2 text-[13px]") : sm ? "h-7 rounded-md px-2.5 text-[12.5px]" : "h-8 rounded-lg px-3 text-[13px]",
        !underline && "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-2 pointer-coarse:before:content-['']",
        !underline && "focus-visible:outline-solid focus-visible:outline-1 focus-visible:-outline-offset-1 focus-visible:outline-fg-3",
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          "flex items-center whitespace-nowrap transition-[scale] duration-150 ease-out-quart group-active/tab:scale-[0.97] group-active/tab:duration-75",
          sm ? "gap-1.5 [&_svg]:size-3.5" : "gap-2 [&_svg]:size-4",
          underline &&
            cn(
              "rounded-md outline-offset-2 group-focus-visible/tab:outline-solid group-focus-visible/tab:outline-1 group-focus-visible/tab:outline-fg-3",
              sm ? "-mx-1 px-1" : "-mx-1 px-1",
            ),
        )}
      >
        {icon && <span className="-ml-0.5 grid shrink-0 place-items-center text-fg-4 transition-colors duration-150 group-hover/tab:text-fg-3 group-data-active/tab:text-fg-2">{icon}</span>}
        {children}
        {count !== undefined && (
          <>
            <span
              aria-hidden
              className={cn(
                "tabular inline-flex min-w-[18px] items-center justify-center rounded-full bg-fg/[0.06] px-1.5 text-[11px] font-medium leading-none",
                "text-fg-3 transition-colors duration-150 group-data-active/tab:bg-fg/[0.09] group-data-active/tab:text-fg-2",
                sm ? "h-4" : "h-[18px]",
              )}
            >
              <NumberFlow
                value={count}
                transformTiming={{ duration: reduce ? 0 : 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                spinTiming={{ duration: reduce ? 0 : 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }}
                opacityTiming={{ duration: reduce ? 150 : 250, easing: "ease-out" }}
              />
            </span>
            <span className="sr-only">({count})</span>
          </>
        )}
        <AnimatePresence initial={false}>
          {dot && (
            <motion.span
              key="dot"
              aria-hidden
              className="size-1.5 shrink-0 rounded-full bg-fg-2"
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0, transition: { duration: 0.12 } }}
              transition={reduce ? { duration: 0.15 } : spring.pop}
            />
          )}
        </AnimatePresence>
        {dot && <span className="sr-only">, updated</span>}
      </span>
    </BaseTabs.Tab>
  );
}
export type TabsPanelsProps = React.ComponentProps<"div"> & {
  animateHeight?: boolean;
};
export function TabsPanels({ animateHeight = true, className, children, style, ...rest }: TabsPanelsProps) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const o = outer.current;
    const i = inner.current;
    if (!animateHeight || !o || !i) return;
    let first = true;
    let settle = 0;
    const ro = new ResizeObserver(() => {
      const h = i.offsetHeight;
      const root = o.closest<HTMLElement>("[data-tabs-root]");
      if (first || root?.dataset.nav === "key") {
        o.style.transitionDuration = "0ms";
        first = false;
      } else {
        o.style.transitionDuration = "";
        o.style.overflow = "clip";
        window.clearTimeout(settle);
        settle = window.setTimeout(() => (o.style.overflow = ""), 320);
      }
      o.style.height = `${h}px`;
    });
    ro.observe(i);
    return () => {
      ro.disconnect();
      window.clearTimeout(settle);
    };
  }, [animateHeight]);
  return (
    <div
      ref={outer}
      className={cn("relative box-content transition-[height] duration-[260ms] ease-in-out-quart", className)}
      style={style}
      {...rest}
    >
      <div ref={inner} className="grid grid-cols-1">
        {children}
      </div>
    </div>
  );
}
export type TabsPanelProps = Omit<BaseTabs.Panel.Props, "className"> & { className?: string };
export function TabsPanel({ className, ...rest }: TabsPanelProps) {
  return (
    <BaseTabs.Panel
      className={cn(
        "col-start-1 row-start-1 min-w-0 rounded-md outline-none",
        "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-[6px] focus-visible:outline-fg-3",
        "transition-[opacity,translate] duration-[220ms] ease-out-expo",
        "data-starting-style:opacity-0 data-starting-style:data-[activation-direction=right]:translate-x-2 data-starting-style:data-[activation-direction=left]:-translate-x-2",
        "data-ending-style:pointer-events-none data-ending-style:absolute data-ending-style:inset-x-0 data-ending-style:top-0 data-ending-style:opacity-0 data-ending-style:duration-[120ms] data-ending-style:ease-out-quart",
        "group-data-[nav=key]/tabs:duration-0",
        className,
      )}
      {...rest}
    />
  );
}