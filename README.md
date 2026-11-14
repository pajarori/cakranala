# Cakra Nala

Cakra Nala mendeteksi operasi pengaruh terkoordinasi di media sosial (buzzer bayaran, bot farm, swarm LLM) dari seberapa bergantung akun satu sama lain, lalu menghitung berapa suara independen yang sebenarnya ada di balik sebuah narasi.

```bash
npm install cakranala
```

```js
import { analyze, simulate } from "cakranala";
import seruni from "cakranala/scenarios/seruni.json" with { type: "json" };

const report = await analyze(simulate(seruni, 1));

for (const n of report.narratives) {
  console.log(n.verdict, n.supporters, "akun,", n.sie.value.toFixed(1), "suara independen:", n.sample);
}
```

`analyze` menerima dataset berisi akun dan aktivitasnya (`post`, `reply`, `quote`, `reshare`, `comment`) dari platform mana pun. Hasilnya berupa klaster akun terkoordinasi, skor koordinasi per akun, dan narasi beserta dukungan nyatanya. Engine tidak butuh training, label, maupun network, dan berjalan di Node maupun Bun.

## Dashboard

Untuk analis, Cakra Nala punya dashboard operasi: pantau target di X, YouTube, Telegram, TikTok, Instagram dan Facebook, lalu hasil deteksi berubah menjadi kasus dengan bukti, graf jaringan, keputusan analis, laporan PDF, ekspor STIX 2.1 dan pemetaan DISARM. Ada juga Perisai, pemeriksa pesan untuk publik.

Butuh [Bun](https://bun.sh).

```bash
bunx cakranala install   # model e5, Typst untuk PDF, Chrome untuk Instagram/Facebook
bunx cakranala serve     # http://localhost:3000
```

Pengunjung pertama membuat akun admin. `bunx cakranala serve --demo` memutar skenario fiktif Pulau Seruni supaya dashboard langsung terisi. `bunx cakranala doctor` menunjukkan fitur mana yang siap dan apa yang kurang.

Data disimpan di `./.cakranala`. Kredensial platform dan proxy diatur dari halaman `/credentials`, penjelasannya ada di [docs/platforms.md](docs/platforms.md).

## Mengumpulkan data

```js
import { createCollector } from "cakranala/collect";

const collector = createCollector({ pool });
const dataset = await collector.collect({ platform: "telegram", kind: "account", target: "kanal_satu", pages: 2 });
```

`pool` adalah sumber kredensial dengan method `count`, `acquire`, `ok`, `limited`, `failed`, `identity` dan `setIdentity`. Telegram dan YouTube jalan tanpa kredensial. Modul ini butuh Bun.

## Cara kerja

Engine membangun graf ketergantungan antar akun dari lima layer bukti:

- Co-action: membalas, mengutip, membagikan URL atau tagar yang sama dalam 15 menit
- Semantic co-framing: makna sama dengan kata berbeda, lewat embedding e5 multibahasa
- Copypasta: teks hampir identik, lewat n-gram karakter, MinHash dan LSH
- Rhythm: jam aktif yang sama melebihi peluang
- Account lifecycle: akun dibuat di hari yang sama dengan pola nama serupa

Setiap layer dibandingkan dengan null model yang dibangun dari data itu sendiri. Interaksi diacak di dalam strata waktu pendek, sehingga berita besar yang memicu banyak akun sekaligus tidak dianggap koordinasi. Ambang klaster dipilih dari data agar decoy FDR tetap di bawah 5 persen, dan setiap klaster harus lolos uji permutasi. Verdict narasi memakai klaster yang ditemukan di separuh waktu lainnya, jadi data yang sama tidak menemukan sekaligus memvonis.

Dukungan sebuah narasi dihitung sebagai suara independen efektif (SIE):

```
SIE = organik + Σ n_c / (1 + (n_c − 1) · ρ_c)
```

dengan `n_c` jumlah akun di klaster `c` dan `ρ_c` korelasi di dalamnya. Seribu akun dari satu klaster yang sangat terkoordinasi bernilai hampir sama dengan satu suara.

Layer semantic co-framing aktif kalau `@huggingface/transformers` terpasang (`cakranala install` mengurusnya). Tanpa itu engine tetap berjalan dengan empat layer.

## Akurasi

Diuji pada arsip berlabel operasi pengaruh negara yang nyata. Peringkat akun mencapai average precision 0,76 dan 0,94, dibanding 0,22 dan 0,75 kalau akun hanya diurutkan berdasarkan jumlah post. Tidak ada akun kontrol yang masuk klaster, dan tidak ada klaster yang muncul pada data yang waktunya digeser. Pada simulasi, bot farm dan buzzer bayaran hampir semua tertangkap tanpa akun organik ikut ditandai. Swarm LLM yang sabar masih kasus tersulit.

## Konfigurasi

Dibaca dari environment atau file `.env` di folder kerja.

| Variabel | Fungsi |
|---|---|
| `LLM_BASE_URL`, `LLM_MODEL`, `LLM_API_KEY` | Endpoint kompatibel OpenAI untuk judul kasus, ringkasan, laporan dan Perisai. Opsional, bisa model lokal seperti Ollama. |
| `PSEUDONYM_SECRET` | Kunci HMAC untuk pseudonim akun. Dibuat otomatis kalau kosong. |
| `CAKRANALA_DATA` | Folder data, default `./.cakranala`. |
| `CAKRANALA_CACHE` | Folder model, Typst dan Chrome, default `~/.cache/cakranala`. |
| `TIKTOK_SIDECAR_URL` | Sidecar untuk TikTok, lihat [docs/platforms.md](docs/platforms.md). |
| `LIBRARY_FEED` | RSS cek fakta untuk Perisai, default TurnBackHoax.id dari MAFINDO. |
| `REPORT_CLASSIFICATION` | Tanda klasifikasi di laporan, default `TERBATAS`. |
| `SHIELD_PER_MINUTE` | Batas permintaan Perisai per alamat per menit, default 20. |

## Docker

```bash
cp .env.example .env
docker compose up -d --build
```

Image sudah berisi model, Typst dan Chrome. Untuk server dengan HTTPS, isi `DOMAIN` di `.env` lalu jalankan `docker compose -f compose.yaml -f docker/compose.prod.yaml up -d --build`. TikTok memakai profile tambahan: `docker compose --profile tiktok up -d`.

## Pengembangan

```bash
bun install
bun run dev        # dashboard dengan hot reload
bun test
bun run typecheck
bun run build
```

## Data dan privasi

Hanya data publik yang dikumpulkan, dan handle diganti pseudonim HMAC sebelum disimpan. Hasil deteksi adalah indikasi pola perilaku terkoordinasi, bukan tuduhan terhadap individu, dan keputusan akhir ada di analis. Setiap perubahan tercatat di audit log yang setiap entrinya memuat hash SHA-256 entri sebelumnya.

## Lisensi

Apache 2.0. Pemetaan DISARM di `web/config/disarm.json` berasal dari DISARM Framework dengan lisensi CC BY-SA 4.0.
