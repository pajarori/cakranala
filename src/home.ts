import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const dataDir = () => resolve(process.env.CAKRANALA_DATA ?? ".cakranala");
export const cacheDir = () => resolve(process.env.CAKRANALA_CACHE ?? join(process.env.XDG_CACHE_HOME ?? join(homedir(), ".cache"), "cakranala"));
