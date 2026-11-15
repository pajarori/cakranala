import type { Flow } from "./flow";

const THANKS = ["thanks for", "thank you for", "terima kasih", "laporan terkirim", "report sent", "we'll review", "kami akan meninjau"];
const NEXT = { click: ["next", "berikutnya", "lanjut", "submit", "kirim", "laporkan", "report"], optional: true };

export const FLOWS: Record<"x" | "instagram" | "facebook" | "tiktok" | "youtube", Record<"account" | "post", Flow>> = {
  x: {
    post: { steps: [{ click: ["more", "lainnya"] }, { click: ["report post", "laporkan postingan"] }, { click: ["spam"] }, NEXT, NEXT], done: THANKS },
    account: { steps: [{ click: ["more", "lainnya"] }, { click: ["report", "laporkan"] }, { click: ["spam"] }, NEXT, NEXT], done: THANKS },
  },
  instagram: {
    post: { steps: [{ click: ["more options", "opsi lainnya"] }, { click: ["report", "laporkan"] }, { click: ["it's spam", "ini spam", "spam"] }, NEXT], done: THANKS },
    account: {
      steps: [{ click: ["options", "opsi"] }, { click: ["report", "laporkan"] }, { click: ["report account", "laporkan akun"], optional: true }, { click: ["it's spam", "ini spam", "spam"] }, NEXT],
      done: THANKS,
    },
  },
  facebook: {
    post: { steps: [{ click: ["actions for this post", "tindakan untuk postingan ini"] }, { click: ["report post", "laporkan postingan"] }, { click: ["spam"] }, NEXT, NEXT], done: THANKS },
    account: { steps: [{ click: ["see options", "lihat opsi", "more", "lainnya"] }, { click: ["report profile", "laporkan profil", "find support or report"] }, { click: ["fake account", "akun palsu", "spam"] }, NEXT, NEXT], done: THANKS },
  },
  tiktok: {
    post: { steps: [{ click: ["more options", "opsi lainnya", "more"] }, { click: ["report", "laporkan"] }, { click: ["spam", "fake engagement", "keterlibatan palsu"] }, NEXT], done: THANKS },
    account: { steps: [{ click: ["more actions", "tindakan lainnya", "more"] }, { click: ["report", "laporkan"] }, { click: ["report account", "laporkan akun"], optional: true }, { click: ["spam", "fake account", "akun palsu"] }, NEXT], done: THANKS },
  },
  youtube: {
    post: { steps: [{ click: ["action menu", "menu tindakan"] }, { click: ["report", "laporkan"] }, { click: ["unwanted commercial content or spam", "spam", "konten komersial yang tidak diinginkan atau spam"] }, NEXT], done: THANKS },
    account: { steps: [{ click: ["more", "lainnya"] }, { click: ["report user", "laporkan pengguna"] }, { click: ["spam and scams", "spam dan penipuan", "spam"] }, NEXT, NEXT], done: THANKS },
  },
};
