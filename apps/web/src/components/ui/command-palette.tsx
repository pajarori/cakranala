"use client";
import { Autocomplete } from "@base-ui/react/autocomplete";
import { Dialog } from "@base-ui/react/dialog";
import { animate, useMotionValue, useReducedMotion, motion, type AnimationPlaybackControls } from "motion/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Loader, Search } from "@/lib/icons";
import { spring } from "@/lib/motion";
import { useControllableState } from "@/lib/use-controllable-state";
import { Kbd, isTypingTarget, matchShortcut, usePlatform } from "@/components/ui/kbd";

export type CommandItem = {
  id: string;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
  keywords?: string[];
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void | Promise<unknown>;
  keepOpen?: boolean;
};

export type CommandGroup = { heading: string; items: CommandItem[] };

export type CommandEntry = { key: string; item: CommandItem; ranges: [number, number][]; score: number };
export type CommandSection = { value: string; items: CommandEntry[] };

function fold(s: string) {
  let text = "";
  const map: number[] = [];
  for (let i = 0; i < s.length; i++) {
    for (const ch of s[i].normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase()) {
      text += ch;
      map.push(i);
    }
  }
  return { text, map };
}

const isBoundary = (text: string, i: number) => i === 0 || /[\s\-_/.·:]/.test(text[i - 1]);

function starts(label: string, map: number[]) {
  return map.map((orig, i) => {
    if (i === 0) return true;
    const prev = label[orig - 1] ?? "";
    const ch = label[orig];
    return map[i - 1] !== orig && (/[\s\-_/.·:]/.test(prev) || (/\p{Lu}/u.test(ch) && /\p{Ll}/u.test(prev)));
  });
}

function acronym(text: string, boundary: boolean[], q: string) {
  const hits: number[] = [];
  const walk = (qi: number, from: number): boolean => {
    if (qi === q.length) return true;
    for (let i = from; i < text.length; i++) {
      if (text[i] !== q[qi]) continue;
      const prev = hits[hits.length - 1];
      if (!boundary[i] && !(prev !== undefined && prev === i - 1)) continue;
      hits.push(i);
      if (walk(qi + 1, i + 1)) return true;
      hits.pop();
    }
    return false;
  };
  return walk(0, 0) ? hits : null;
}

function merge(ranges: [number, number][]) {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

export function scoreCommand(item: CommandItem, query: string): { score: number; ranges: [number, number][] } | null {
  const q = fold(query.trim()).text.replace(/\s+/g, " ");
  if (!q) return { score: 0, ranges: [] };
  const label = fold(item.label);
  const back = (s: number, e: number): [number, number] => [label.map[s], label.map[e - 1] + 1];
  if (label.text === q) return { score: 1000, ranges: [[0, item.label.length]] };
  let score = label.text.startsWith(q) ? 300 : 0;
  const ranges: [number, number][] = [];
  const keywords = (item.keywords ?? []).map((k) => fold(k).text);
  const hint = item.hint ? fold(item.hint).text : "";
  let ok = true;
  for (const token of q.split(" ")) {
    let at = -1;
    for (let i = label.text.indexOf(token); i >= 0; i = label.text.indexOf(token, i + 1)) {
      if (isBoundary(label.text, i)) {
        at = i;
        break;
      }
      if (at < 0) at = i;
    }
    if (at >= 0) {
      score += isBoundary(label.text, at) ? (at === 0 ? 100 : 80) : 50;
      ranges.push(back(at, at + token.length));
    } else if (keywords.some((k) => k.startsWith(token))) score += 30;
    else if (keywords.some((k) => k.includes(token)) || hint.includes(token)) score += 15;
    else {
      ok = false;
      break;
    }
  }
  if (ok) return { score, ranges: merge(ranges) };
  const hits = acronym(label.text, starts(item.label, label.map), q.replace(/ /g, ""));
  if (!hits) return null;
  return { score: 40 - hits[0], ranges: merge(hits.map((h) => back(h, h + 1))) };
}

export function useCommandSearch(groups: CommandGroup[], query: string, { recent = [] as string[], recentLabel = "Recent" } = {}) {
  return useMemo(() => {
    const q = query.trim();
    if (!q) {
      const byId = new Map(groups.flatMap((g) => g.items.map((i) => [i.id, i] as const)));
      const recentItems = recent.map((id) => byId.get(id)).filter((i): i is CommandItem => !!i && !i.disabled);
      const shown = new Set(recentItems.map((i) => i.id));
      const sections: CommandSection[] = [];
      if (recentItems.length) sections.push({ value: recentLabel, items: recentItems.map((item) => ({ key: `recent:${item.id}`, item, ranges: [], score: 0 })) });
      for (const g of groups) {
        const items = g.items.filter((i) => !shown.has(i.id)).map((item) => ({ key: item.id, item, ranges: [], score: 0 }));
        if (items.length) sections.push({ value: g.heading, items });
      }
      return sections;
    }
    const sections: CommandSection[] = [];
    for (const g of groups) {
      const items: CommandEntry[] = [];
      for (const item of g.items) {
        const m = scoreCommand(item, q);
        if (m) items.push({ key: item.id, item, ranges: m.ranges, score: m.score });
      }
      items.sort((a, b) => b.score - a.score);
      if (items.length) sections.push({ value: g.heading, items });
    }
    return sections.sort((a, b) => b.items[0].score - a.items[0].score);
  }, [groups, query, recent, recentLabel]);
}
export function CommandHighlight({ text, ranges }: { text: string; ranges: [number, number][] }) {
  if (!ranges.length) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let at = 0;
  ranges.forEach(([s, e], i) => {
    if (s > at) parts.push(<span key={`u${i}`} className="text-fg-3 transition-colors group-data-highlighted/item:text-fg-2">{text.slice(at, s)}</span>);
    parts.push(<mark key={`m${i}`} className="bg-transparent text-fg">{text.slice(s, e)}</mark>);
    at = e;
  });
  if (at < text.length) parts.push(<span key="tail" className="text-fg-3 transition-colors group-data-highlighted/item:text-fg-2">{text.slice(at)}</span>);
  return <>{parts}</>;
}
export function useDelayedFlag(on: boolean, delay = 150, min = 300) {
  const [shown, setShown] = useState(false);
  const since = useRef(0);
  useEffect(() => {
    let t: number | undefined;
    if (on && !shown) {
      t = window.setTimeout(() => {
        since.current = performance.now();
        setShown(true);
      }, delay);
    } else if (!on && shown) {
      t = window.setTimeout(() => setShown(false), Math.max(0, min - (performance.now() - since.current)));
    }
    return () => window.clearTimeout(t);
  }, [on, shown, delay, min]);
  return shown;
}
export function useListGlide(reduce: boolean) {
  const [list, setList] = useState<HTMLElement | null>(null);
  const y = useMotionValue(0);
  const height = useMotionValue(36);
  const opacity = useMotionValue(0);
  useEffect(() => {
    if (!list) return;
    let keyboard = true;
    let shown = false;
    let running: AnimationPlaybackControls[] = [];
    const stop = () => {
      running.forEach((c) => c.stop());
      running = [];
    };
    const place = () => {
      const el = list.querySelector<HTMLElement>("[data-highlighted]");
      stop();
      if (!el) {
        shown = false;
        opacity.jump(0);
        return;
      }
      let top = 0;
      for (let n: HTMLElement | null = el; n && n !== list; n = n.offsetParent as HTMLElement | null) top += n.offsetTop;
      if (!shown || keyboard || reduce) {
        y.jump(top);
        height.jump(el.offsetHeight);
      } else {
        running.push(animate(y, top, spring.follow), animate(height, el.offsetHeight, spring.follow));
      }
      opacity.jump(el.hasAttribute("data-disabled") ? 0.5 : 1);
      shown = true;
    };
    const onKey = () => (keyboard = true);
    const onPointer = () => (keyboard = false);
    const observer = new MutationObserver(place);
    observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-highlighted"] });
    document.addEventListener("keydown", onKey, true);
    list.addEventListener("pointermove", onPointer);
    place();
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      list.removeEventListener("pointermove", onPointer);
      stop();
    };
  }, [list, reduce, y, height, opacity]);
  return { setList, y, height, opacity };
}
export function useMeasuredHeight() {
  const [height, setHeight] = useState<number | null>(null);
  const ref = useCallback((node: HTMLElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(() => setHeight(node.offsetHeight));
    ro.observe(node);
    return () => ro.disconnect();
  }, []);
  return [ref, height] as const;
}
export const paletteClasses = {
  backdrop: cn(
    "inset-0 z-(--z-overlay) bg-overlay",
    "transition-opacity duration-200 ease-out-quart data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-150",
    "data-instant:transition-none",
  ),
  viewport: "inset-0 z-(--z-dialog) flex items-start justify-center px-2 pb-2 sm:px-4",
  popup: cn(
    "relative flex max-h-full w-full max-w-[560px] min-w-0 flex-col overflow-hidden rounded-2xl border border-line-2 bg-raised text-fg shadow-pop outline-none",
    "origin-top transition-[opacity,scale,translate] duration-[180ms] ease-out-expo",
    "data-starting-style:-translate-y-1 data-starting-style:scale-[0.98] data-starting-style:opacity-0",
    "data-ending-style:scale-[0.99] data-ending-style:opacity-0 data-ending-style:duration-[120ms] data-ending-style:ease-out-quart",
    "motion-reduce:data-starting-style:translate-y-0 motion-reduce:data-starting-style:scale-100 motion-reduce:data-ending-style:scale-100",
    "data-instant:transition-none",
  ),
  input: "h-full min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-fg-4 sm:text-[14px] [&::-webkit-search-cancel-button]:hidden",
  groupLabel: "px-2.5 pt-3 pb-1.5 font-mono text-2xs uppercase tracking-[0.08em] text-fg-3 select-none",
  item: cn(
    "group/item relative z-[1] flex h-9 cursor-default scroll-my-1.5 items-center gap-2.5 rounded-lg px-2.5 text-[13px] text-fg outline-none select-none",
    "pointer-coarse:h-11 data-disabled:text-fg-4",
  ),
  glide: cn(
    "pointer-events-none absolute inset-x-0 top-0 rounded-lg bg-fg/[0.06]",
    "transition-colors duration-100 group-has-[[data-highlighted]:active]/list:bg-fg/[0.1]",
  ),
};
export function PaletteFooter({ hints, children, className }: { hints: [keys: string | string[], label: string][]; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex h-10 shrink-0 items-center gap-4 border-t border-line px-3.5 text-[11.5px] text-fg-3 pointer-coarse:hidden", className)}>
      {hints.map(([keys, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <Kbd keys={keys} size="sm" />
          {label}
        </span>
      ))}
      {children && <span className="ml-auto min-w-0 truncate text-fg-4">{children}</span>}
    </div>
  );
}
export type CommandPaletteProps = {
  groups: CommandGroup[];
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  hotkey?: string | false;
  hotkeyTarget?: React.RefObject<HTMLElement | null>;
  placeholder?: string;

  recent?: string[];
  defaultRecent?: string[];
  onRecentChange?: (ids: string[]) => void;
  recentLimit?: number;
  onSelect?: (item: CommandItem) => void;
  loading?: boolean;
  container?: Dialog.Portal.Props["container"];
  label?: string;
  footer?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
};
type Failure = { key: string; message: string };
export function CommandPalette({
  groups,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  hotkey = "mod+k",
  hotkeyTarget,
  placeholder = "Search or jump to…",
  recent: recentProp,
  defaultRecent = [],
  onRecentChange,
  recentLimit = 4,
  onSelect,
  loading = false,
  container,
  label = "Command palette",
  footer,
  className,
  children,
}: CommandPaletteProps) {
  const reduce = !!useReducedMotion();
  const platform = usePlatform();
  const [open, setOpen] = useControllableState({ value: openProp, defaultValue: defaultOpen, onChange: onOpenChange });
  const [recent, setRecent] = useControllableState({ value: recentProp, defaultValue: defaultRecent, onChange: onRecentChange });
  const [query, setQuery] = useState("");
  const [instant, setInstant] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const contained = container != null;
  const shownRecent = useMemo(() => (recentLimit > 0 ? recent.slice(0, recentLimit) : []), [recent, recentLimit]);
  const sections = useCommandSearch(groups, query, { recent: shownRecent });
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  const spinning = useDelayedFlag(loading || busy !== null);
  const { setList: setGlideList, y: glideY, height: glideH, opacity: glideO } = useListGlide(reduce);
  const [measure, contentHeight] = useMeasuredHeight();
  const close = (fromKeyboard: boolean) => {
    setInstant(fromKeyboard);
    setOpen(false);
  };
  const run = async (entry: CommandEntry, fromKeyboard: boolean) => {
    const { item } = entry;
    if (item.disabled || busy) return;
    setFailure(null);
    if (recentLimit > 0) setRecent((r) => [item.id, ...r.filter((id) => id !== item.id)].slice(0, recentLimit * 2));
    let result: void | Promise<unknown>;
    try {
      result = item.onSelect?.();
    } catch (error) {
      return setFailure({ key: entry.key, message: messageOf(error) });
    }
    if (result && typeof (result as Promise<unknown>).then === "function") {
      setBusy(entry.key);
      try {
        await result;
      } catch (error) {
        setBusy(null);
        return setFailure({ key: entry.key, message: messageOf(error) });
      }
      setBusy(null);
    }
    onSelect?.(item);
    if (!item.keepOpen) close(fromKeyboard);
  };
  usePaletteHotkey({
    hotkey,
    target: hotkeyTarget,
    open,
    onToggle: () => {
      setInstant(true);
      setOpen(!open);
    },
  });
  const onPopupKeyDown = (e: React.KeyboardEvent) => {
    const native = e.nativeEvent;
    if (!native.metaKey && !native.ctrlKey && !native.altKey) return;
    for (const g of groups)
      for (const item of g.items) {
        if (item.shortcut && !item.disabled && matchShortcut(native, item.shortcut, platform)) {
          e.preventDefault();
          e.stopPropagation();
          void run({ key: item.id, item, ranges: [], score: 0 }, true);
          return;
        }
      }
  };
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next, details) => {
        const ev = details.event as Event | undefined;
        setInstant(ev instanceof KeyboardEvent || (ev instanceof MouseEvent && ev.detail === 0));
        setOpen(next);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (isOpen) return;
        setQuery("");
        setFailure(null);
        setBusy(null);
      }}
    >
      {children}
      <Dialog.Portal container={container}>
        <Dialog.Backdrop data-instant={instant ? "" : undefined} className={cn(contained ? "absolute" : "fixed", paletteClasses.backdrop)} />
        <Dialog.Viewport className={cn(contained ? "absolute pt-14" : "fixed pt-[12vh]", paletteClasses.viewport)}>
          <Dialog.Popup
            initialFocus={inputRef}
            data-instant={instant ? "" : undefined}
            onKeyDown={onPopupKeyDown}
            className={cn(paletteClasses.popup, className)}
          >
            <Dialog.Title className="sr-only">{label}</Dialog.Title>
            <Autocomplete.Root
              inline
              open
              items={sections}
              filteredItems={sections}
              value={query}
              onValueChange={(next, details) => {
                if (details.reason === "item-press") return;
                setQuery(next);
                setFailure(null);
              }}
              onOpenChange={(next, details) => {
                if (!next && details.reason === "escape-key") close(true);
              }}
              itemToStringValue={(entry: CommandEntry) => entry.item.label}
              autoHighlight="always"
              keepHighlight
            >
              <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-line pr-2.5 pl-4 pointer-coarse:h-14">
                <span className="relative grid size-4 shrink-0 place-items-center text-fg-3">
                  <Search size={16} className={cn("transition-[opacity,scale] duration-150", spinning && "scale-75 opacity-0")} />
                  <Loader size={16} className={cn("absolute animate-spin transition-[opacity,scale] duration-150", !spinning && "scale-75 opacity-0")} />
                </span>
                <Autocomplete.Input
                  ref={inputRef}
                  placeholder={placeholder}
                  aria-label={placeholder.replace(/…$/, "")}
                  autoComplete="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  className={paletteClasses.input}
                />
                <Dialog.Close
                  aria-label="Close"
                  className={cn(
                    "relative grid shrink-0 place-items-center rounded-md outline-none",
                    "transition-[scale,opacity] duration-150 hover:opacity-80 active:scale-[0.94]",
                    "focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                    "after:absolute after:-inset-3 after:content-[''] pointer-fine:after:hidden",
                  )}
                >
                  <Kbd keys="esc" size="sm" />
                </Dialog.Close>
              </div>
              <div
                style={{ height: contentHeight ?? undefined }}
                className="max-h-[min(22rem,55dvh)] min-h-0 overflow-y-auto overscroll-contain transition-[height] duration-150 ease-out-quart motion-reduce:transition-none"
              >
                <div ref={measure} className="p-1.5">
                  <Autocomplete.Empty>
                    {count === 0 && (
                      <div className="flex flex-col items-center gap-3 px-6 py-9 text-center">
                        {loading ? (
                          <p className="text-[13px] text-fg-3">Searching…</p>
                        ) : query.trim() ? (
                          <>
                            <p className="max-w-full truncate text-[13px] text-fg-2">
                              No results for <span className="text-fg">“{query.trim()}”</span>
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                setQuery("");
                                inputRef.current?.focus();
                              }}
                              className={cn(
                                "inline-flex h-7 items-center rounded-md border border-line-2 bg-raised px-2.5 text-[12px] font-medium text-fg shadow-[var(--shadow)]",
                                "transition-[background-color,border-color,scale] duration-150 hover:border-fg-4 hover:bg-hover active:scale-[0.97]",
                                "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
                              )}
                            >
                              Clear search
                            </button>
                          </>
                        ) : (
                          <p className="text-[13px] text-fg-3">No commands yet</p>
                        )}
                      </div>
                    )}
                  </Autocomplete.Empty>
                  <div ref={setGlideList} className="group/list relative">
                  <motion.div aria-hidden style={{ y: glideY, height: glideH, opacity: glideO }} className={paletteClasses.glide} />
                  <Autocomplete.List className="outline-none empty:hidden">
                    {(section: CommandSection) => (
                      <Autocomplete.Group key={section.value} items={section.items}>
                        <Autocomplete.GroupLabel className={cn(paletteClasses.groupLabel, "first:pt-1.5")}>{section.value}</Autocomplete.GroupLabel>
                        <Autocomplete.Collection>
                          {(entry: CommandEntry) => (
                            <CommandRow
                              key={entry.key}
                              entry={entry}
                              busy={busy === entry.key}
                              failure={failure?.key === entry.key ? failure.message : null}
                              onRun={(fromKeyboard) => void run(entry, fromKeyboard)}
                            />
                          )}
                        </Autocomplete.Collection>
                      </Autocomplete.Group>
                    )}
                  </Autocomplete.List>
                  </div>
                </div>
              </div>
              <PaletteFooter
                hints={[
                  [["up", "down"], "Navigate"],
                  ["enter", "Open"],
                ]}
              >
                {footer}
              </PaletteFooter>
              <Autocomplete.Status className="sr-only">
                {busy ? "Working…" : failure ? failure.message : query.trim() ? (count === 0 ? "No results" : `${count} ${count === 1 ? "result" : "results"}`) : ""}
              </Autocomplete.Status>
            </Autocomplete.Root>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function usePaletteHotkey({
  hotkey,
  target,
  open,
  onToggle,
}: {
  hotkey: string | false;
  target?: React.RefObject<HTMLElement | null>;
  open: boolean;
  onToggle: () => void;
}) {
  const platform = usePlatform();
  const toggle = useRef(onToggle);
  useEffect(() => {
    toggle.current = onToggle;
  });
  useEffect(() => {
    if (!hotkey) return;
    const el: HTMLElement | Window = target?.current ?? window;
    const bare = !/(mod|ctrl|meta|cmd|alt|option)\+/i.test(hotkey);
    const onKey = (event: Event) => {
      const e = event as KeyboardEvent;
      if (!matchShortcut(e, hotkey, platform)) return;
      if (bare && isTypingTarget(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      toggle.current();
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [hotkey, target, platform, open]);
}
export function messageOf(error: unknown) {
  return error instanceof Error && error.message ? error.message : "That didn’t work. Try again.";
}
export type CommandRowProps = {
  entry: CommandEntry;
  busy?: boolean;
  failure?: string | null;
  onRun: (fromKeyboard: boolean) => void;
  trailing?: React.ReactNode;
};
export function CommandRow({ entry, busy, failure, onRun, trailing }: CommandRowProps) {
  const { item } = entry;
  return (
    <Autocomplete.Item
      value={entry}
      disabled={item.disabled}
      onClick={(e) => onRun(e.detail === 0)}
      aria-busy={busy || undefined}
      data-failed={failure ? "" : undefined}
      className={paletteClasses.item}
    >
      {item.icon && (
        <span className="flex size-4 shrink-0 items-center justify-center text-fg-3 transition-colors group-data-highlighted/item:text-fg-2 [&_svg]:size-4">
          {item.icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="max-w-full shrink-0 truncate">
          <CommandHighlight text={item.label} ranges={entry.ranges} />
        </span>
        {failure ? (
          <span role="alert" className="min-w-0 truncate text-[12.5px] text-danger">
            {failure}
          </span>
        ) : (
          item.hint && <span className="min-w-0 truncate text-[12.5px] text-fg-3">{item.hint}</span>
        )}
      </span>
      <span className="relative flex shrink-0 items-center justify-end">
        {busy ? (
          <Loader size={14} className="animate-spin text-fg-2" />
        ) : (
          (trailing ?? (item.shortcut && <Kbd keys={item.shortcut} variant="ghost" size="sm" className="transition-colors group-data-highlighted/item:[&_kbd]:text-fg-2" />))
        )}
      </span>
    </Autocomplete.Item>
  );
}
export type CommandPaletteTriggerProps = Omit<Dialog.Trigger.Props, "children"> & {
  label?: string;
  shortcut?: string | false;
};
export function CommandPaletteTrigger({ label = "Search or jump to…", shortcut = "mod+k", className, ...rest }: CommandPaletteTriggerProps) {
  return (
    <Dialog.Trigger
      className={cn(
        "group/trigger relative inline-flex h-8 w-full min-w-0 max-w-[280px] select-none items-center gap-2 rounded-lg border border-line-2 bg-raised pr-1.5 pl-2.5 text-[12.5px] text-fg-3 shadow-[var(--shadow)]",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart hover:border-fg-4 hover:text-fg-2 active:scale-[0.98] active:duration-75",
        "outline-none focus-visible:outline-solid focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-fg-3",
        "data-popup-open:border-fg-4 data-popup-open:text-fg-2",
        typeof className === "string" ? className : undefined,
      )}
      {...rest}
    >
      <Search size={14} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      {shortcut && <Kbd keys={shortcut} size="sm" className="pointer-coarse:hidden" />}
    </Dialog.Trigger>
  );
}