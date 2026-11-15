import type { Platform } from "../index";
import type { Identity } from "./targets";

export type Channel = Platform | "komdigi";
export type ReceiptStatus = "sent" | "needs_manual" | "failed" | "limited";

export interface Receipt {
  status: ReceiptStatus;
  ref?: string;
  error?: string;
  until?: number;
  screenshot?: Uint8Array;
}

export interface ReportTarget {
  channel: Channel;
  kind: "account" | "post";
  url: string;
  who?: Identity;
}

export interface Complaint {
  title: string;
  text: string;
  links: string[];
  pdf?: Uint8Array;
}
