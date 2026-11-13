export const ease = {
  out: [0.16, 1, 0.3, 1] as const,
  outQuart: [0.25, 1, 0.5, 1] as const,
  inOut: [0.76, 0, 0.24, 1] as const,
  in: [0.4, 0, 1, 1] as const,
  drawer: [0.32, 0.72, 0, 1] as const,
};

export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 0.7 },
  soft: { type: "spring", stiffness: 260, damping: 28, mass: 0.9 },
  follow: { type: "spring", stiffness: 650, damping: 45, mass: 0.5 },
  pop: { type: "spring", stiffness: 600, damping: 30, mass: 0.6 },
  sheet: { type: "spring", stiffness: 300, damping: 32, mass: 1 },
  bouncy: { type: "spring", stiffness: 420, damping: 20, mass: 0.7 },
} as const;

export const dur = {
  press: 0.12,
  hover: 0.16,
  tooltip: 0.16,
  menu: 0.18,
  indicator: 0.22,
  dialog: 0.26,
  toast: 0.28,
  page: 0.38,
  reveal: 0.8,
} as const;

export const stagger = { tight: 0.012, items: 0.02, words: 0.03, lines: 0.08 } as const;

export const pop = {
  initial: { opacity: 0, scale: 0.96, filter: "blur(2px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.97, filter: "blur(1px)", transition: { duration: 0.1 } },
} as const;

export const swap = {
  initial: { opacity: 0, scale: 0.6, filter: "blur(3px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.6, filter: "blur(3px)" },
} as const;
