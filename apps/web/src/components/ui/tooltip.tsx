"use client";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { createContext, useContext, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type Side = "top" | "bottom" | "left" | "right";
type Align = "start" | "center" | "end";

const subscribe = () => () => {};
const isApple = () => /Mac|iPhone|iPad|iPod/.test(navigator.platform || navigator.userAgent);
function useApple() {
  return useSyncExternalStore(subscribe, isApple, () => true);
}
const glyphs: Record<string, [apple: string, other: string, aria: string]> = {
  mod: ["⌘", "Ctrl", "Meta"],
  "⌘": ["⌘", "Ctrl", "Meta"],
  cmd: ["⌘", "Ctrl", "Meta"],
  shift: ["⇧", "Shift", "Shift"],
  "⇧": ["⇧", "Shift", "Shift"],
  alt: ["⌥", "Alt", "Alt"],
  option: ["⌥", "Alt", "Alt"],
  "⌥": ["⌥", "Alt", "Alt"],
  ctrl: ["⌃", "Ctrl", "Control"],
  "⌃": ["⌃", "Ctrl", "Control"],
  enter: ["↵", "Enter", "Enter"],
  esc: ["Esc", "Esc", "Escape"],
};
const glyph = (key: string, apple: boolean) => glyphs[key.toLowerCase()]?.[apple ? 0 : 1] ?? (key.length === 1 ? key.toUpperCase() : key);

export function toAriaShortcut(keys: string[]) {
  return keys.map((k) => glyphs[k.toLowerCase()]?.[2] ?? (k.length === 1 ? k.toUpperCase() : k)).join("+");
}
export type TooltipShortcutProps = React.ComponentProps<"kbd"> & { keys: string[] };

export function TooltipShortcut({ keys, className, ...rest }: TooltipShortcutProps) {
  const apple = useApple();
  return (
    <kbd className={cn("-mr-0.5 flex shrink-0 items-center gap-0.5", className)} {...rest}>
      {keys.map((k, i) => {
        const g = glyph(k, apple);
        return (
          <span
            key={i}
            className={cn(
              "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[5px] border border-line-2 bg-frame px-1 leading-none text-fg-2",
              /^[⌘⇧⌥⌃↵]$/.test(g) ? "font-sans text-[12px]" : "font-mono text-[10.5px]",
            )}
          >
            {g}
          </span>
        );
      })}
    </kbd>
  );
}
export type TooltipProviderProps = {
  delay?: number;

  closeDelay?: number;
  timeout?: number;
  children?: React.ReactNode;
};
export function TooltipProvider({ delay = 500, closeDelay = 0, timeout = 400, children }: TooltipProviderProps) {
  return (
    <BaseTooltip.Provider delay={delay} closeDelay={closeDelay} timeout={timeout}>
      {children}
    </BaseTooltip.Provider>
  );
}
const look = cn(
  "relative rounded-lg border border-line-2 bg-raised text-[12px] leading-4 text-fg shadow-pop outline-none",
  "max-w-[min(18rem,var(--available-width))] text-pretty [overflow-wrap:anywhere]",
);
const enter = cn(
  "origin-(--transform-origin) ease-out-expo",
  "data-starting-style:scale-96 data-starting-style:opacity-0",
  "data-[side=top]:data-starting-style:translate-y-0.5 data-[side=bottom]:data-starting-style:-translate-y-0.5",
  "data-[side=left]:data-starting-style:translate-x-0.5 data-[side=right]:data-starting-style:-translate-x-0.5",
  "data-ending-style:opacity-0 data-ending-style:ease-out-quart",
  "data-instant:transition-none",
  "motion-reduce:data-starting-style:scale-100 motion-reduce:data-starting-style:translate-0",
);
function Arrow({ className }: { className?: string }) {
  return (
    <BaseTooltip.Arrow
      className={cn(
        "pointer-events-none flex h-[7px] w-3.5",
        "data-[side=bottom]:-top-1.5 data-[side=top]:-bottom-1.5 data-[side=top]:rotate-180",
        "data-[side=left]:-right-2.5 data-[side=left]:rotate-90 data-[side=right]:-left-2.5 data-[side=right]:-rotate-90",
        className,
      )}
    >
      <svg width="14" height="7" viewBox="0 0 14 7" fill="none" aria-hidden className="block overflow-visible">
        <path d="M0 7c2.5 0 4-1 5.2-3.6l.6-1.3c.5-1.1 1.9-1.1 2.4 0l.6 1.3C10 6 11.5 7 14 7z" className="fill-raised" />
        <path d="M0 7c2.5 0 4-1 5.2-3.6l.6-1.3c.5-1.1 1.9-1.1 2.4 0l.6 1.3C10 6 11.5 7 14 7" className="stroke-line-2" vectorEffect="non-scaling-stroke" />
      </svg>
    </BaseTooltip.Arrow>
  );
}
export type TooltipRootProps = BaseTooltip.Root.Props;
export function TooltipRoot(props: TooltipRootProps) {
  return <BaseTooltip.Root {...props} />;
}

export type TooltipTriggerProps = BaseTooltip.Trigger.Props & {
  shortcut?: string[];
};
export function TooltipTrigger({ shortcut, ...rest }: TooltipTriggerProps) {
  return <BaseTooltip.Trigger aria-keyshortcuts={shortcut ? toAriaShortcut(shortcut) : undefined} {...rest} />;
}
export type TooltipContentProps = Omit<BaseTooltip.Popup.Props, "className"> & {
  className?: string;
  side?: Side;
  align?: Align;
  sideOffset?: number;
  alignOffset?: number;
  shortcut?: string[];
  arrow?: boolean;
  container?: BaseTooltip.Portal.Props["container"];
};
export function TooltipContent({
  side = "top",
  align = "center",
  sideOffset,
  alignOffset = 0,
  shortcut,
  arrow = false,
  container,
  className,
  children,
  ...rest
}: TooltipContentProps) {
  return (
    <BaseTooltip.Portal container={container}>
      <BaseTooltip.Positioner
        side={side}
        align={align}
        sideOffset={sideOffset ?? (arrow ? 10 : 8)}
        alignOffset={alignOffset}
        collisionPadding={8}
        arrowPadding={10}
        className="z-(--z-tooltip)"
      >
        <BaseTooltip.Popup
          className={cn(
            look,
            enter,
            "flex min-h-[26px] items-center gap-2 px-2 py-[3px]",
            "transition-[opacity,scale,translate] duration-150 data-ending-style:duration-100",
            className,
          )}
          {...rest}
        >
          {arrow && <Arrow />}
          <span className="min-w-0">{children}</span>
          {shortcut && shortcut.length > 0 && <TooltipShortcut keys={shortcut} />}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  );
}
export type TooltipProps = Omit<TooltipRootProps, "children"> & {
  content: React.ReactNode;
  shortcut?: string[];
  side?: Side;
  align?: Align;
  sideOffset?: number;
  arrow?: boolean;

  delay?: number;
  closeDelay?: number;
  container?: TooltipContentProps["container"];

  className?: string;
  children: React.ReactElement<Record<string, unknown>>;
};
export function Tooltip({
  content,
  shortcut,
  side,
  align,
  sideOffset,
  arrow,
  delay,
  closeDelay,
  container,
  className,
  children,
  ...root
}: TooltipProps) {
  return (
    <BaseTooltip.Root {...root}>
      <TooltipTrigger render={children} delay={delay} closeDelay={closeDelay} shortcut={shortcut} />
      <TooltipContent side={side} align={align} sideOffset={sideOffset} arrow={arrow} shortcut={shortcut} container={container} className={className}>
        {content}
      </TooltipContent>
    </BaseTooltip.Root>
  );
}
type Payload = { content: React.ReactNode; shortcut?: string[] };
type Handle = ReturnType<typeof BaseTooltip.createHandle<Payload>>;
const GroupContext = createContext<Handle | null>(null);
export type TooltipGroupProps = {
  side?: Side;
  align?: Align;
  sideOffset?: number;
  delay?: number;
  container?: TooltipContentProps["container"];
  className?: string;
  children?: React.ReactNode;
};
export function TooltipGroup({ side = "top", align = "center", sideOffset = 8, delay = 500, container, className, children }: TooltipGroupProps) {
  const [handle] = useState(() => BaseTooltip.createHandle<Payload>());
  return (
    <GroupContext.Provider value={handle}>
      <BaseTooltip.Provider delay={delay}>{children}</BaseTooltip.Provider>
      <BaseTooltip.Root handle={handle}>
        {({ payload }) => (
          <BaseTooltip.Portal container={container}>
            <BaseTooltip.Positioner
              side={side}
              align={align}
              sideOffset={sideOffset}
              collisionPadding={8}

              className={cn(
                "z-(--z-tooltip) h-(--positioner-height) w-(--positioner-width) max-w-(--available-width)",
                "transition-[top,left,right,bottom] duration-220 ease-out-quart data-instant:transition-none",
              )}
            >
              <BaseTooltip.Popup
                className={cn(
                  look,
                  enter,
                  "h-(--popup-height,auto) w-(--popup-width,auto) overflow-clip",
                  "transition-[opacity,scale,translate,width,height] [transition-duration:150ms,150ms,150ms,220ms,220ms]",
                  "data-ending-style:[transition-duration:100ms]",
                  className,
                )}
              >
                <BaseTooltip.Viewport
                  className={cn(
                    "relative h-full w-full [--pad:8px]",
                    "[&>*]:flex [&>*]:min-h-6 [&>*]:w-max [&>*]:max-w-[min(calc(18rem-2px),calc(var(--available-width)-2px))] [&>*]:items-center [&>*]:gap-2 [&>*]:px-(--pad) [&>*]:py-[3px]",
                    "[&>[data-previous]]:absolute [&>[data-previous]]:left-0 [&>[data-previous]]:top-0",
                    "[&>*]:transition-[opacity,translate,filter] [&>*]:duration-200 [&>*]:ease-out-expo",
                    "data-[activation-direction~=right]:[&>[data-current][data-starting-style]]:translate-x-2",
                    "data-[activation-direction~=left]:[&>[data-current][data-starting-style]]:-translate-x-2",
                    "data-[activation-direction~=down]:[&>[data-current][data-starting-style]]:translate-y-1.5",
                    "data-[activation-direction~=up]:[&>[data-current][data-starting-style]]:-translate-y-1.5",
                    "[&>[data-current][data-starting-style]]:opacity-0 [&>[data-current][data-starting-style]]:blur-[2px]",
                    "data-[activation-direction~=right]:[&>[data-previous][data-ending-style]]:-translate-x-2",
                    "data-[activation-direction~=left]:[&>[data-previous][data-ending-style]]:translate-x-2",
                    "data-[activation-direction~=down]:[&>[data-previous][data-ending-style]]:-translate-y-1.5",
                    "data-[activation-direction~=up]:[&>[data-previous][data-ending-style]]:translate-y-1.5",
                    "[&>[data-previous][data-ending-style]]:opacity-0 [&>[data-previous][data-ending-style]]:blur-[2px] [&>[data-previous]]:duration-120",
                    "data-instant:[&>*]:transition-none motion-reduce:[&>*]:translate-0 motion-reduce:[&>*]:blur-none",
                  )}
                >
                  {payload && (
                    <>
                      <span className="min-w-0">{payload.content}</span>
                      {payload.shortcut && payload.shortcut.length > 0 && <TooltipShortcut keys={payload.shortcut} />}
                    </>
                  )}
                </BaseTooltip.Viewport>
              </BaseTooltip.Popup>
            </BaseTooltip.Positioner>
          </BaseTooltip.Portal>
        )}
      </BaseTooltip.Root>
    </GroupContext.Provider>
  );
}
export type TooltipGroupTriggerProps = Omit<BaseTooltip.Trigger.Props, "handle" | "payload" | "render" | "children"> & {
  content: React.ReactNode;
  shortcut?: string[];
  children: React.ReactElement<Record<string, unknown>>;
};
export function TooltipGroupTrigger({ content, shortcut, children, ...rest }: TooltipGroupTriggerProps) {
  const handle = useContext(GroupContext);
  if (!handle) throw new Error("TooltipGroupTrigger must be inside a TooltipGroup");
  return (
    <BaseTooltip.Trigger
      handle={handle}
      payload={{ content, shortcut }}
      render={children}
      aria-keyshortcuts={shortcut ? toAriaShortcut(shortcut) : undefined}
      {...rest}
    />
  );
}