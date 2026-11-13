# CAKRA NALA — Rencana Build v3

> Cognitive Threat Intelligence & Human-Centric Buzzer Defense
> Kartika Cyber Hackathon 2026 · Kategori **Cognitive Domain (Siber Sosial)**

---

## 0. Audit v3 (13 Nov 2026): apa yang salah atau kurang di v2, dan perbaikannya

| # | Temuan audit | Kenapa penting | Perbaikan |
|---|---|---|---|
| A1 | **Scope Gelombang 1 terlalu besar** (8 kontribusi + 5 collector dalam ±2 hari) | Juri menilai *prototype berfungsi* (25%). Sepuluh fitur setengah jadi kalah dari tiga fitur yang mulus. | Ditetapkan satu **Jalur Emas Demo** (§6). Hanya fitur di jalur itu yang masuk Gelombang 1. |
| A2 | **False positive dari popularitas.** Ribuan orang me-retweet satu post viral, atau semua orang membahas gol timnas dalam menit yang sama, lalu terlihat seperti "koordinasi". | Riset menunjukkan pembobotan popularitas mengurangi edge palsu (Synchronized Action Framework). Studi WWW 2025 (Luceri dkk.) **tidak menemukan koordinasi yang signifikan setelah dibandingkan dengan data kontrol**. Tanpa baseline, detektor cenderung "menemukan" apa yang dicari analis. | Tambah **lapis null-model** untuk semua lapis: (1) bobot **IDF** untuk objek co-action (co-retweet atas post langka jauh lebih informatif); (2) **ekspektasi co-occurrence** berdasarkan aktivitas akun × popularitas objek (configuration model) dan hanya ekses di atas ekspektasi yang dihitung; (3) **uji permutasi** (geser waktu secara acak dalam topik) untuk p-value edge, dengan koreksi multiple comparison. |
| A3 | **Lapis semantik (L2) rawan** menyamakan *topik sama* dengan *koordinasi* | Semua orang yang membahas isu yang sama tentu mirip secara semantik | L2 bekerja di level **klaim** (bukan topik), memakai **kelangkaan klaim** (IDF klaim) dan **ketatnya waktu**. Edge dihitung hanya bila **≥2 lapis independen** setuju. |
| A4 | **Rumus SIE belum operasional**: bagaimana ρ_c dihitung? Bagaimana dengan akun yang ada di banyak klaster atau narasi? | Metrik utama harus bisa dipertanggungjawabkan | ρ_c = rata-rata *dependence* berpasangan dalam klaster (bobot edge setelah null-model, dinormalisasi 0..1). Satu akun dihitung sekali per narasi (klaster dominannya). **Interval ketidakpastian** dari bootstrap anggota dan coverage data. Validasi di simulator: SIE ≈ jumlah aktor independen sebenarnya. |
| A5 | **Evaluasi sirkular**: kita membuat simulator dan sekaligus detektornya | Juri bisa menilai "tentu saja berhasil, datanya buatan sendiri" | (1) Konten swarm dibuat oleh **agen LLM (DeepSeek) berpersona** yang tidak tahu cara kerja detektor. (2) **Ground truth nyata dari Indonesia: operasi informasi Papua**. Twitter menurunkan 795 akun (2020) setelah investigasi Bellingcat/BBC; ASPI menemukan pola posting **interval 30 menit** (cocok dengan detektor kisi kita); studi peer-review atas 1,25 juta tweet Papua. Dipakai bila arsip Twitter IO masih bisa diunduh (perlu dicek). (3) Data kontrol berlabel IU (arXiv 2411.10609). |
| A6 | **Kedaulatan data LLM.** DeepSeek adalah layanan yang di-host di luar negeri. | Mengirim data intelijen TNI AD ke server asing adalah risiko keamanan | LLM lewat **adapter OpenAI-compatible**: demo memakai DeepSeek API, produksi diarahkan ke **model open-weight self-hosted** (bobot DeepSeek/Qwen bisa di-host on-prem). Data di-*pseudonymize* sebelum dikirim. Core **tetap jalan tanpa LLM**. |
| A7 | **Risiko hukum demo publik**: menandai akun nyata sebagai "buzzer" di link publik bisa dianggap **pencemaran nama baik (UU ITE)** | Link submission bisa diakses siapa pun | Bahasa probabilistik: "**indikasi pola terkoordinasi**", bukan "buzzer". Handle akun nyata **selalu di-pseudonymize** di mode publik. Demo publik memakai skenario simulasi + snapshot data nyata yang disamarkan. |
| A8 | **Endpoint koleksi live di link publik bisa disalahgunakan** dan membakar sesi X | Satu sesi X adalah single point of failure | Koleksi live hanya dengan **token operator**. Pengunjung publik melihat snapshot ter-cache. Cek Kolom Komentar dibatasi per IP dan memakai antrean. |
| A9 | **Satu akun X = satu titik gagal** (pengujian memakai sesi pribadi) | Akun bisa dikunci | Budget konservatif, cache agresif, pemantau kesehatan sesi. **Disarankan memakai akun X terpisah** untuk produksi demo. |
| A10 | Stealth UI belum diuji dengan bundler Bun | Bisa memakan setengah hari | Diuji di jam pertama pembuatan web. Fallback ke shadcn standar. |

### Hasil verifikasi teknis tambahan (13 Nov)
- **X GraphQL dengan sesi:** `UserByScreenName` ✅ (**limit 150/15 menit**, dari header). `SearchTimeline` ✅ setelah memakai header `x-client-transaction-id` dari paket npm **`x-client-transaction-id` v0.3.3 (jalan di Bun)**: 20 tweet per request, **limit 50/15 menit terkonfirmasi** dari header `x-rate-limit-limit`. Ini mengonfirmasi angka "±50" yang sebelumnya belum terverifikasi. Budget per akun: **±1.000 tweet per 15 menit (±4.000 per jam)**.
- `queryId` diambil **dinamis** dari `main.*.js` (SearchTimeline, UserByScreenName, UserTweets, TweetDetail, Followers ditemukan). Retweeters ada di chunk lain dan perlu dicari.
- **Waktu presisi milidetik dari Snowflake ID terverifikasi** pada data nyata.
- **DeepSeek API ✅**: model `deepseek-flash` (DeepSeek-V4.1-Flash, konteks 1 juta token, **input gambar didukung**, sehingga Perisai bisa menerima *screenshot* post).

### Ide baru dari riset putaran ini
1. **Kontrafaktual "Tanpa Operasi".** Grafik volume narasi ditampilkan dua kali: apa adanya, dan **jika klaster terkoordinasi dihapus**. Satu gambar yang langsung dipahami komandan maupun warga: "tanpa operasi, isu ini tidak pernah trending".
2. **Red Team Adaptif.** Agen penyerang (DeepSeek) diberi umpan balik dari detektor lalu mencoba menghindar (memperlambat ritme, memvariasikan parafrase, mencampur dengan konten organik). Hasilnya **kurva ketahanan**: seberapa mahal (jumlah akun dan waktu) bagi operasi untuk lolos dari Cakra Nala. Ini mengubah klaim "akurasi" menjadi klaim **"biaya penghindaran"**, yang lebih jujur dan lebih relevan secara militer.
3. **Perisai multimodal.** Warga mengunggah *screenshot* post (bukan hanya teks atau link). Dengan input gambar dari model, teks dan konteksnya diekstrak, lalu dicocokkan dengan klaster dan narasi aktif.
4. **Kisi 30 menit Papua sebagai *regression test*.** Pola nyata dari operasi Indonesia yang terdokumentasi dijadikan uji otomatis untuk detektor kisi dan urutan giliran.

---

## 1. Tesis: ganti pertanyaannya

Hampir semua tool di kategori ini bertanya **"Apakah akun ini bot?"** atau **"Apakah teks ini hoaks?"**. Riset 2025–2026 menunjukkan dua pertanyaan itu sudah kalah:

| Jenis aktor | Kenapa detektor lama gagal |
|---|---|
| **Buzzer manusia bayaran** (Rp40rb–1,5jt per tugas; kasus Kejagung 2025: 150 orang dalam satu "Cyber Army") | Pelakunya manusia asli, jadi **lolos detektor bot**. |
| **Swarm agen LLM** (botnet fox8; simulasi USC ISI, WWW '26) | Teksnya bervariasi dan terdengar manusiawi. **Botometer dan detektor teks AI gagal membedakannya dari manusia.** |
| **Akun hasil beli / alih fungsi** (pasar akun marak, Kompas 2025) | Riwayatnya bersih dan reputasinya asli, jadi dipakai sebagai kedok. |
| **SMM panel dan phone farm** | Engagement-nya terlihat "organik" kalau dilihat per akun. |

Satu hal **tidak bisa dihilangkan** oleh semua jenis operasi itu: **mereka harus berkoordinasi** untuk menciptakan *konsensus palsu*, dan koordinasi selalu meninggalkan **ketergantungan statistik** (dependence) antar akun.

> **CAKRA NALA tidak bertanya "siapa yang palsu", tapi "berapa banyak pikiran independen yang sebenarnya ada di balik sebuah narasi".**

Senjata utama buzzer bukan kebohongan, tapi **social proof**: kesan bahwa "semua orang berpikir begini". Riset swarm 2026 menyebut synthetic consensus sebagai mekanisme yang paling efektif. Jadi yang kita ukur dan bongkar adalah konsensus palsunya, baik untuk analis TNI AD maupun untuk warga.

---

## 2. Tujuh kontribusi baru

### ① Suara Independen Efektif (SIE): metrik utama
Diadaptasi dari *effective sample size* (Kish design effect) di statistik survei. Untuk sebuah narasi yang didukung N akun yang terbagi dalam klaster c:

```
SIE = Σ_c  n_c / (1 + (n_c − 1) · ρ_c)        ρ_c = kekuatan ketergantungan dalam klaster (0..1)
Indeks Konsensus Sintetis (IKS) = 1 − SIE / N
```

Akun organik berkontribusi sekitar 1 suara. Klaster 200 akun dengan ρ = 0.95 hanya bernilai sekitar 1 suara.
Output yang bisa dibaca komandan maupun warga: **"Tampak didukung 2.340 akun, tapi suara independen efektif hanya ±41. Amplifikasi semu ×57."**

### ② Graf Ketergantungan Multiplex dengan lapis *semantic co-framing*
Lima lapis bukti yang **independen satu sama lain**. Makin banyak lapis yang setuju, makin tinggi keyakinan:

| Lapis | Yang dideteksi | Tahan terhadap |
|---|---|---|
| L1 Co-action perilaku | repost / URL / urutan hashtag yang sama dalam Δt (dengan time-decay) | buzzer manusia |
| L2 **Co-framing semantik** | *klaim yang sama dengan kata berbeda* dalam Δt (embedding multilingual, mean-centered) | **parafrase LLM** (lapis yang tidak dimiliki tool copas biasa) |
| L3 Kopling ritme | korelasi deret waktu aktivitas per menit dan pola lead-lag | penyamaran konten |
| L4 Copypasta leksikal | MinHash/LSH near-duplicate | bot murahan (lapis yang murah dan cepat) |
| L5 Ko-signatur siklus hidup | akun dibuat berdekatan, template handle sama, **dorman lalu bangun bersamaan** | akun beli dan sleeper |

### ③ Sidik jari perkakas: "urutan giliran" (rotation-order fingerprint)
Phone farm dan script SMM mengiterasi **daftar akun yang sama**. Kalau satu klaster meledak beberapa kali dan **urutan akun yang posting cenderung sama** di tiap ledakan (Kendall-τ tinggi antar burst), hampir pasti itu dijalankan script. Kelompok manusia organik tidak punya urutan tetap.
Ditambah **jitter kisi** (lattice): jarak antar-post yang terkuantisasi (mis. setiap 30 detik ± sedikit) dideteksi lewat autokorelasi interval.

### ④ Rekonstruksi Brief: menebak isi perintah koordinator
Operasi buzzer berjalan dengan pola *koordinator → grup WA → tim lapangan*. Dari sebuah klaster, Cakra Nala menyimpulkan:
- **T0 komando**: titik onset ledakan yang serentak ("47 akun mulai dalam 6 menit sejak 19:02 WIB")
- **Seeder**: akun yang secara konsisten memposting lebih dulu (analisis lead-lag), yaitu kandidat koordinator lapangan
- **Isi brief**: medoid klaim dan frame dominan klaster, yaitu talking point yang diduga dibagikan ke tim

Ini mengubah deteksi menjadi **intelijen**: siapa yang memerintah, kapan, dan apa pesannya.

### ⑤ Forensik siklus hidup akun
Change-point detection pada lintasan embedding, gaya bahasa, dan jam aktif per akun mendeteksi **akun ganti pemilik / alih fungsi**. Sinyal yang paling kuat ada di level kelompok: **banyak akun yang lama dorman lalu bangun di hari yang sama dengan topik yang sama** (sleeper activation).

### ⑥ Pelacakan Tembus (Breakout) dan Peringatan Dini
Narasi dipantau dari **inti terkoordinasi → pinggiran organik**:
- *Organic Capture Rate*: proporsi pendukung yang organik dari waktu ke waktu
- Kategori **Breakout Scale** (Nimmo, Brookings) dihitung otomatis, sejauh data platform memungkinkan
- **Titik Tembus**: estimasi kapan narasi akan diambil alih oleh publik organik. Peringatan dikirim *sebelum* narasi itu viral, karena pada titik itu intervensi masih murah.

Setiap temuan juga dipetakan ke **taktik DISARM Red** (Plan/Prepare/Execute/Assess) dan bisa diekspor sebagai **STIX 2.1**. Format ini interoperable dengan standar CTI internasional, sehingga relevan untuk PUSSIBERAD.

### ⑦ Perisai Nalar: lapisan perlindungan warga yang memakai intelijen di atas
Bukan sekadar pemeriksa link penipuan:
- **Konteks konsensus**: warga menempel pesan atau link, lalu mendapat jawaban *"Narasi ini sedang didorong secara terkoordinasi. Terlihat ramai, tapi suara independennya cuma ±41."* Ini langsung menetralkan efek social proof.
- **Sorot teknik, bukan vonis**: bagian pesan yang memakai urgensi, otoritas palsu, ketakutan, iming-iming, kambing hitam, atau dikotomi palsu ditandai dan dijelaskan. Riset inoculation menunjukkan pendekatan berbasis teknik lebih tahan lama dan lebih bisa diterapkan ke kasus lain daripada pendekatan berbasis klaim.
- **Penjaga impersonasi TNI AD**: deteksi domain atau handle tiruan (homoglyph, punycode, typosquat) terhadap registri kanal resmi, plus pola penipuan rekrutmen.
- **Kartu Vaksin Narasi**: setiap kampanye aktif otomatis menghasilkan kartu prebunking yang menjelaskan *teknik* yang sedang dipakai. Kartu ini bisa didistribusikan lewat bot Telegram.

### ⑧ (Bonus) Arena Wargame: simulator dan pelatihan analis
Data nyata sulit didapat dan musuh terus beradaptasi, jadi Cakra Nala membawa **simulator operasi pengaruh** sendiri:
- Aktor: kerumunan organik, **kejadian viral organik (hard negative**, misalnya berita gempa atau gol timnas, yang wajib *tidak* ditandai), buzzer bayaran, bot farm, swarm LLM, dan sleeper akun beli
- **Matriks Ketahanan**: tiap lapis detektor diuji terhadap tiap jenis serangan (ablation). Ini membuktikan kenapa multiplex diperlukan.
- **Mode latihan analis**: peserta menebak klaster mana yang CIB lalu diberi skor. Ini terkait langsung dengan pembinaan SDM Bintara Siber TNI AD.

---

## 3. Strategi per platform: data publik, jalur unofficial

**Prinsip:** hanya **data publik** (post, komentar, profil, dan engagement yang bisa dilihat siapa pun). **Tanpa WhatsApp dan tanpa chat privat.** Fokus ke platform tempat buzzer paling aktif.

### 3.1 Prioritas platform (berdasarkan prevalensi buzzer)

| # | Platform | Kenapa | Bukti |
|---|---|---|---|
| 1 | **X / Twitter** | Medan utama perang trending topic dan serangan terkoordinasi. Paling banyak dipelajari (SNA Drone Emprit). | Riset UB Pemilu 2024; investigasi 7 klaster buzzer politik (pemimpin opini + operator teknis + ratusan akun anonim) |
| 2 | **TikTok** | Disebut sebagai **platform dengan sebaran hoaks Pemilu 2024 terbanyak**. Pemilih muda jadi target. | Riset RSH Unpad; kasus Kejagung 2025 |
| 3 | **Instagram** | Serbuan komentar di akun pejabat/institusi; rekrutmen buzzer mensyaratkan ≥500 follower IG/TikTok | Kompas 2025; kasus Kejagung (TikTok/IG/X) |
| 4 | **YouTube** | Serbuan komentar ("commenter mob") di video berita dan kanal resmi | COSMOS UALR |
| 5 | **Facebook** | Grup dan Page, audiens usia lebih tua, jaringan Page yang berganti nama | ICWSM repurposing |

### 3.2 Hasil uji langsung (13 Nov 2026, tanpa login, dari mesin dev)

| Jalur | Hasil | Catatan |
|---|---|---|
| YouTube via `youtubei.js` (Innertube) | ✅ Pencarian 19 video, 60 komentar dalam 3 halaman, jalan di **Bun** | **Waktu posting hanya relatif** ("1 jam yang lalu") |
| X endpoint *syndication* timeline profil | ✅ 200, berisi `full_text` | Hanya ±20 post terbaru per profil (tanpa login) |
| X GraphQL dengan sesi (`UserByScreenName`, `SearchTimeline` + `x-client-transaction-id`) | ✅ 200, 20 tweet per request | Limit terkonfirmasi: 150 dan 50 per 15 menit. Waktu ms dari Snowflake ID. |
| Instagram `web_profile_info` | ❌ 404 tanpa login | Perlu sesi login (akun burner) |
| TikTok halaman web | ❌ halaman challenge bot (1,4 KB) | Perlu browser sungguhan untuk signature X-Bogus/X-Gnarly |

### 3.3 Jalur unofficial per platform

| Platform | Jalur utama | Cadangan | Data yang didapat | Risiko |
|---|---|---|---|---|
| **X** | **GraphQL internal x.com dengan sesi cookie** (`auth_token` + `ct0`) dari pool akun. Pola sama dengan twscrape (Python, aktif per Agustus 2026). Di TS: client GraphQL tipis buatan sendiri, atau lib seperti `agent-twitter-client` (perlu dicek apakah masih jalan). | Endpoint syndication (tanpa login) untuk timeline profil. Instance Nitter publik (tidak stabil). | Search terbaru, timeline, retweeter, reply, profil (tanggal buat akun, follower) | Sering rusak saat front-end X berubah. Akun pool bisa dikunci. snscrape sudah mati. |
| **TikTok** | **Browser headless (Playwright/Patchright) yang mencegat XHR** `/api/search`, `/api/comment/list`, `/api/post/item_list`. Browser yang menandatangani request sendiri, jadi tidak perlu membongkar signature. | `tiktok-signature` (npm, headless + SDK TikTok) atau lib reverse-engineering X-Bogus/X-Gnarly (rapuh) | Video, caption, hashtag, **music/sound ID**, komentar, profil | Signature dirotasi. Deteksi bot memberi respons kosong. Perlu proxy residensial bila skala besar. |
| **Instagram** | **Sesi login burner + endpoint private/web API** (pola instagrapi). Di TS: Playwright login lalu cegat GraphQL. | Instaloader (Python, publik tanpa login terbatas). Pihak ketiga (Apify dkk.) | Post, **komentar**, hashtag (login-gated), profil | `challenge_required` dari IP datacenter. Risiko ban tertinggi. |
| **YouTube** | **`youtubei.js`** ✅ teruji | Data API v3 resmi (gratis, kuota 10k/hari) | Video, komentar + balasan, kanal (tanggal dibuat) | Rendah |
| **Facebook** | Playwright dengan sesi login, cegat GraphQL komentar Page/grup publik | Repo `facebook-scraper` (mayoritas tidak terawat per 2026) | Post Page, komentar, reaksi | Tinggi; fallback ke impor data |
| **Threads** (bonus) | Guest GraphQL (beberapa scraper mengklaim tanpa login) | API resmi keyword search | Post, balasan | Sedang |

### 3.4 Temuan desain penting: presisi waktu

Deteksi koordinasi butuh presisi **detik**, sementara UI sering hanya menampilkan "1 jam yang lalu". Solusinya:
1. **Waktu dari ID.** ID post di X adalah *Snowflake*, jadi timestamp-nya presisi milidetik bisa didekode langsung dari ID: `(id >> 22) + 1288834974657`. ID video TikTok juga menyimpan detik pembuatan di 32 bit teratas (dipakai alat OSINT; **akan diverifikasi saat implementasi**). Untuk komentar, API internal X dan TikTok mengembalikan `created_at`/`create_time` absolut.
2. **Mode Pantau (first-seen).** Untuk platform yang waktunya relatif (YouTube), target dipantau berkala (mis. tiap 60 detik) dan *waktu pertama terlihat* dicatat. Hasilnya presisi ±1 menit plus urutan relatif yang tepat (NEWEST_FIRST).
3. Setiap event membawa **`timePrecision`** (ms / s / min / approx), dan detektor otomatis menyesuaikan window Δt dengan presisi tersebut. Dengan begitu tidak muncul edge palsu dari data yang kasar.

### 3.5 Arsitektur pengambilan data: collector terpisah dari modul inti (detail paket di §5)

```
packages/collect-*/  (Bun; Playwright dijalankan sebagai worker terpisah bila tidak kompatibel dengan Bun)
  ├─ sources/x        GraphQL (pool sesi) + syndication
  ├─ sources/tiktok   browser + intersepsi XHR
  ├─ sources/instagram browser login burner + intersepsi
  ├─ sources/youtube  youtubei.js + mode pantau
  ├─ sources/facebook browser + intersepsi
  ├─ sessions         pool akun/cookie, rotasi, cooldown, deteksi ban
  ├─ ratelimit        token bucket per sumber, jitter, backoff
  └─ store            SQLite (bun:sqlite) → Dataset (Skema Terpadu) → cakranala
```
**Core tetap murni.** Collector hanya mengubah data mentah platform menjadi `Event` dalam Skema Terpadu. Kalau satu scraper rusak, core dan analisisnya tidak ikut rusak, dan analisis bisa jalan dari data yang sudah tersimpan.

**Strategi penargetan.** Scraper unofficial tidak bisa mengambil semua post (tidak ada firehose), jadi pengumpulan berangkat dari **seed**:
- kata kunci atau hashtag isu (misalnya isu terkait TNI AD)
- akun atau post target (akun resmi institusi, yang sering jadi sasaran serbuan komentar)
- **tautan yang dilaporkan warga** (lihat 3.6)

Dari seed, pengumpulan **melebar satu langkah**: siapa yang me-retweet, berkomentar, atau memakai sound yang sama. Itu sudah cukup untuk membangun graf koordinasi.

### 3.6 Skema Interaksi Terpadu
Semua platform diterjemahkan ke satu bentuk:
`Aktor —(post · reshare · quote · reply · comment · react · mention · use_sound)→ Objek @ waktu (+timePrecision)`, plus `konten` (teks, transkrip, sidik media) dan `konteks` (platform, seed, komunitas).
Kelima lapis deteksi (L1–L5) berjalan sama di semua platform. Sinyal khas tiap platform ditambahkan sebagai plugin:

| Platform | Plugin sinyal khas |
|---|---|
| X | perang trending (hashtag dipaksa naik oleh klaster sempit), co-retweet dalam detik, quote-dogpile |
| TikTok | reuse **sound ID**, watermark, suara TTS, template split-screen, caption berulang (ICWSM). Duet/stitch diberi bobot rendah. |
| Instagram / Facebook | **serbuan komentar** (banyak komentar template/emoji dalam menit pertama), riwayat ganti nama Page atau akun |
| YouTube | commenter mob, lonjakan komentar sesaat setelah upload |

### 3.7 Pengganti "Sensor Warga" (tanpa WhatsApp): **Cek Kolom Komentar**
Warga menempel **tautan post publik** (X/TikTok/IG/YouTube) yang terasa "ramai tidak wajar". Collector lalu mengambil komentar, engager, dan riwayat akun-akun yang terlibat, kemudian Perisai Nalar menjawab:
> *"62% komentar di post ini berasal dari 3 klaster terkoordinasi. Dari 1.240 komentar, suara independen efektifnya ±48."*

Fitur ini sekaligus:
- (a) **melindungi warga** dari ilusi social proof, tepat di tempat mereka melihatnya, dan
- (b) **menjadi seed penargetan** bagi analis, karena tautan yang banyak dilaporkan warga adalah sinyal dini.

### 3.8 Rute Narasi lintas platform
Yang dihubungkan adalah **klaim**, bukan orang. Embedding klaim yang sama dilacak waktu kemunculannya di X → TikTok → Instagram → YouTube → portal berita (RSS), sehingga terlihat jalur pencucian narasi dan kategori **Breakout Scale**-nya.

### 3.9 Hukum, ToS & etika
- Hanya data publik. Tidak ada chat privat, DM, atau grup tertutup.
- Jalur unofficial melanggar **ToS platform** (risiko ban akun, bukan pidana selama datanya publik dan tidak membobol sistem). Karena itu:
  - akun pengumpul adalah akun operasional terpisah (burner)
  - ada rate limit yang sopan
  - semua jalur unofficial ditandai *untuk operasi berizin* (konteks pertahanan, UU PDP Pasal 15)
  - setiap source punya fallback impor data
- **Privacy by design:** handle di-pseudonymize (HMAC) secara default, analisis berfokus pada perilaku kolektif, dan identitas asli hanya bisa dibuka oleh peran berwenang dengan log audit.

### 3.10 Data referensi nyata
- **Pustaka klaim hoaks:** dataset NLP-BRIN (TurnBackHoax/Mafindo 2018–2023, MIT, gated) untuk pencocokan di Perisai Nalar.
- **Registri kanal resmi TNI AD:** rekrutmen hanya lewat `ad.rekrutmen-tni.mil.id` dan gratis. Kasus Kulon Progo 2025: korban rugi Rp310 juta. Registri ini harus diverifikasi lagi ke sumber resmi.

### 3.11 Rate limit & proteksi anti-bot per platform

**Sikap:** proteksi dipelajari supaya collector **patuh, hemat, dan tahan banting**, bukan untuk membobolnya. Cakra Nala **tidak** memakai pemecah CAPTCHA, spoofing fingerprint/anti-detect browser, atau rotasi proxy untuk menghindari blokir. Kalau sebuah sumber memblokir, collector **mundur** dan beralih ke fallback (impor data, API resmi, atau penyedia data berlisensi). Untuk operasi nyata TNI AD, jalur yang tepat adalah kerja sama resmi dengan platform atau penyedia berlisensi. Ini juga menjadi poin kelayakan implementasi.

| Platform | Proteksi utama (per riset Nov 2026) | Batas yang diketahui | Konsekuensi desain |
|---|---|---|---|
| **X** | Sesi wajib (guest token anonim sudah hilang); header **`x-client-transaction-id`** yang diturunkan dari bundle JS x.com; **queryId GraphQL berganti** saat front-end diperbarui (twscrape issue #306) | ±50 request SearchTimeline per 15 menit per akun (dari dokumen scraper, **belum terverifikasi**). Respons 429 / error 88 → akun dikunci sampai reset (twscrape PR #364). | queryId diambil dinamis dari bundle web, bukan hardcode. Penguncian dicatat per akun per endpoint. Budget kasar: ±50 × 20 = **±1.000 tweet per 15 menit per akun**. |
| **TikTok** | Signature dinamis **X-Bogus, X-Gnarly, msToken** (msToken kedaluwarsa dalam hitungan menit), ttwid; VM JS yang diobfuscate (webmssdk); fingerprint browser; puzzle CAPTCHA; rate limit per IP dan per fingerprint | Tidak dipublikasikan | Pakai browser sungguhan yang menjalankan SDK TikTok sendiri, dengan kecepatan seperti manusia. **Kalau muncul CAPTCHA, berhenti dan masuk cooldown**, jangan dipecahkan. Volume kecil dan tertarget (seed post/hashtag). |
| **Instagram** | Login wajib untuk hampir semua data; `challenge_required` (terutama dari IP datacenter); doc_id GraphQL berganti; risiko ban akun tertinggi | API resmi: angkanya diperdebatkan (200 call/jam vs berbasis impresi). Jalur web: tidak dipublikasikan. | Prioritas rendah untuk crawling. Dipakai **tertarget** (Cek Kolom Komentar satu post). Jika ada challenge, sesi dihentikan dan perlu verifikasi manual oleh operator. |
| **YouTube** | **PO Token** (BotGuard), terikat per video ID; peringatan "Sign in to confirm you're not a bot" bila IP ditandai | Data API resmi: 10.000 unit/hari, komentar 1 unit per halaman | Komentar via `youtubei.js` sudah teruji tanpa PO token. Bila diblokir, **fallback ke Data API v3 resmi**. |
| **Facebook** | Login wajib, checkpoint akun, token `lsd`/`fb_dtsg`, doc_id berganti | Tidak dipublikasikan | Prioritas terendah, fallback impor data |

**Lapisan "Collector Patuh" (`packages/collect-*`)**
- **Token bucket per (sumber × akun × endpoint)** dengan jitter acak. Batas konservatif, di bawah perkiraan limit.
- **Mesin status sesi:** `sehat → dibatasi (cooldown sampai reset) → ditantang (CAPTCHA/challenge: berhenti, minta operator) → mati`. Tidak ada retry agresif. Exponential backoff.
- **Pemantau kesehatan sumber:** grafik tingkat error, 429, dan challenge per sumber di dashboard, supaya operator tahu kapan sebuah jalur rusak (misalnya queryId X berubah).
- **Anggaran pengumpulan:** setiap misi (seed) mendapat kuota request, dan analisis bisa berjalan dengan data parsial. Detektor memperhitungkan *coverage* (misalnya "data komentar 40% terambil"), sehingga skor SIE diberi **interval ketidakpastian**, bukan angka palsu yang terlihat presisi.
- **Cache & dedup:** objek yang sudah diambil tidak diminta ulang. Mode Pantau hanya mengambil halaman terbaru.
- **Kontrak adapter:** setiap source harus punya fallback impor JSON/CSV dengan skema yang sama, supaya demo tetap jalan meskipun scraper rusak di hari-H.

**Bonus intelijen:** proteksi yang sama juga harus diakali oleh pelaku buzzer (SMM panel, phone farm). Jejak cara mereka mengakalinya (akun dengan pola pembuatan seragam, aktivitas yang terlalu rata di bawah rate limit, burst yang berhenti tepat di batas limit) bisa menjadi **sinyal L5 tambahan**.

---

## 4. Model & teknik

| Kebutuhan | Pilihan | Status |
|---|---|---|
| Embedding multibahasa (ID) | `Xenova/multilingual-e5-small` (q8, ±50 MB) via `@huggingface/transformers` | **✅ Sudah diuji jalan di Bun 1.4.4**: ±3 ms/teks di CPU, parafrase 0.97 vs tidak-terkait 0.79. Perlu mean-centering korpus karena anisotropi. |
| Upgrade bila sempat | `gte-multilingual-base` / `bge-m3` | opsional |
| Komunitas graf | `graphology` + Louvain | |
| Near-duplicate | MinHash + LSH (ditulis sendiri) | |
| Change-point | CUSUM / BOCPD sederhana (ditulis sendiri) | |
| Lead-lag, ritme, kisi | cross-correlation, autokorelasi, Kendall-τ (ditulis sendiri) | |
| SIE | Kish design effect (ditulis sendiri) | |
| LLM (opsional, adapter OpenAI-compatible) | **DeepSeek `deepseek-flash`** ✅ teruji. Dipakai untuk: agen red-team berpersona, ekstraksi dan normalisasi klaim, narasi brief, penjelasan Perisai, membaca screenshot. Produksi: model open-weight self-hosted. | Core **tetap berjalan tanpa LLM** (air-gap friendly). Data di-pseudonymize sebelum dikirim. |
| Null-model koordinasi | Bobot IDF objek, configuration-model expected co-occurrence, uji permutasi waktu + koreksi multiple comparison | **Wajib** (audit A2) |
| Teks dari video/audio (Gelombang 2) | Whisper kecil (ASR), sidik audio, pHash keyframe | opsional |

**Tanpa label, tanpa training.** Semua metode unsupervised dan explainable, sehingga tidak bergantung pada dataset berlabel Indonesia (yang memang tidak tersedia) dan bisa diterapkan ke isu baru.


---

## 5. Arsitektur: `cakranala` = modul deteksi + simulasi, dan hanya itu

### Prinsip
1. **`cakranala` tidak tahu dari mana datanya berasal.** Modul ini tidak berisi scraper, HTTP, database, atau kunci API. Inputnya satu: **`Dataset` dalam Skema Interaksi Terpadu** (berversi, `schemaVersion`). Siapa pun bisa memberinya data: scraper kita, ekspor platform, dataset riset, data milik instansi, atau simulatornya sendiri.
2. **Deteksi dan simulasi tinggal di modul yang sama**, karena keduanya bicara dalam skema yang sama. Simulator adalah *generator* `Dataset` dengan ground truth, sementara detektor adalah *konsumen*-nya. Evaluasi menutup lingkarannya.
3. **Kemampuan berat atau eksternal diinjeksi lewat interface**, tidak di-*import*: `Embedder` (embedding teks) dan `Reasoner` (LLM). Tanpa keduanya, modul tetap jalan memakai MinHash, statistik, dan heuristik. Dengan keduanya, lapis semantik dan narasi aktif.
4. **Deterministik dan portabel.** Seed yang sama menghasilkan hasil yang sama. Murni TypeScript dengan dependensi minimal (`graphology` + Louvain), sehingga jalan di Bun, Node, Deno, browser, maupun worker. Bisa dipakai di dashboard ini, di CLI analis, di pipeline instansi lain, atau di jaringan *air-gapped*.

### Peta paket
```
cakranala/                                bun workspaces
├─ packages/cakranala/        ← MODUL INTI (yang dipakai ulang di mana-mana)
│  ├─ schema      Dataset, Actor, Event(action, target, ts, timePrecision), Content, Context + validator + versi
│  ├─ detect/
│  │   ├─ layers/     L1 co-action · L2 co-framing · L3 ritme · L4 copypasta · L5 siklus hidup  (interface Layer)
│  │   ├─ null/       IDF objek, expected co-occurrence, uji permutasi
│  │   ├─ graph       multiplex → Louvain → klaster
│  │   ├─ forensics   T0/seeder/brief, urutan giliran, kisi, change-point
│  │   ├─ consensus   ρ, SIE (+interval), IKS, kontrafaktual "Tanpa Operasi"
│  │   └─ narrative   klaim, medoid, breakout, peringatan dini
│  ├─ shield     Perisai Nalar: teknik manipulasi, URL/impersonasi, cocok narasi
│  ├─ simulate   aktor (organik, viral organik, buzzer bayaran, bot farm, swarm, sleeper) + ground truth
│  ├─ evaluate   P/R/F1, matriks ketahanan, kurva biaya penghindaran
│  ├─ privacy    pseudonymisasi (HMAC) untuk output
│  └─ ports      interface Embedder, Reasoner (tanpa implementasi)
│
├─ packages/embed-e5/         impl Embedder: transformers.js + multilingual-e5-small (opsional, ±50 MB)
├─ packages/reasoner-openai/  impl Reasoner: API OpenAI-compatible (DeepSeek sekarang, model self-hosted nanti)
│
├─ packages/collect-x/        scraper X  → menghasilkan Dataset   (tidak di-import oleh cakranala)
├─ packages/collect-youtube/  scraper YouTube → Dataset
│   (nanti: collect-tiktok, collect-instagram, ...)
│
└─ apps/web/                  Bun.serve + React + shadcn/Stealth: memanggil collect-* → cakranala → UI
```

**Arah dependensi satu jalur:** `apps/web → collect-*, embed-*, reasoner-* → cakranala`. Paket `cakranala` tidak bergantung pada paket mana pun dalam repo. Kalau scraper X rusak atau diganti, modul inti tidak perlu disentuh.

### API publik modul inti
```ts
import { analyze, simulate, evaluate, shield, validate } from "cakranala";

// 1) Data dari mana saja yang patuh skema
const ds = validate(jsonDariManaSaja);             // atau: simulate({ seed: 7, scenario: "pemilu-buzzer" })

// 2) Deteksi (embedder/reasoner opsional)
const report = await analyze(ds, { embedder, reasoner, windowSec: 60 });
report.narratives[0]; // { claim, supporters, sie: { value: 41, ci: [33, 52] }, iks, clusters, brief, counterfactual }

// 3) Evaluasi bila ada ground truth (simulasi atau dataset berlabel)
const score = evaluate(report, ds.truth);

// 4) Perisai untuk warga
const s = await shield({ text: "Rekrutmen TNI AD jalur khusus, transfer Rp2jt..." }, { report, reasoner });
```

### Kontrak collector (yang dipelajari dari uji data nyata X, 13 Nov)
Collector bertanggung jawab atas semua masalah khas platform, sehingga detektor tetap bersih:
- **Field platform bisa berpindah tanpa pemberitahuan.** Contoh: follower X pindah dari `legacy.followers_count` ke `relationship_counts.followers`. Mapper dibuat defensif dan setiap collector punya *fixture* respons asli untuk tes regresi.
- **Operator `lang:id` menjatuhkan pencarian X ke indeks arsip** (yang terambil tweet 2013–2014). Saringan bahasa dilakukan di sisi klien memakai field `lang`, dan rentang waktu dikunci dengan `since:`.
- **Pencarian X tidak mengembalikan retweet sama sekali** (RT = 0 dari 160 tweet). Pada sampel isu Jokowi/Gibran, **55–70% hasilnya adalah reply**. Konsekuensinya:
  - (a) lapis L1 di X dibangun terutama dari **co-reply/co-quote ke target yang sama** (pola serbuan reply)
  - (b) co-retweet butuh **ekspansi lewat endpoint Retweeters** per tweet, dengan biaya kuota tambahan
- **Volume dan budget:** isu "gibran" ±7 tweet per menit, "jokowi" ±3,6 per menit. Budget satu akun (±1.000 tweet per 15 menit) cukup untuk mengikuti 2–4 jam percakapan satu isu. Itu memadai untuk mode tertarget, tapi tidak untuk pemantauan luas.
- Setiap `Event` membawa `timePrecision` dan `coverage` supaya detektor tahu seberapa lengkap datanya.

---

## 6. Jadwal: dua gelombang

Fakta penting: **link submission ditutup 15 Nov**, tapi **demo final baru 24 Nov**. Finalis masih punya ±9 hari tambahan untuk memperkuat produk.

### Jalur Emas Demo (video 3–5 menit; semua yang ada di jalur ini wajib mulus)
1. **Ruang Situasi**: narasi "isu X" terlihat didukung 2.340 akun → **SIE ±41, amplifikasi semu ×57** → grafik **kontrafaktual "Tanpa Operasi"**.
2. **Peta Jaringan**: graf multiplex, toggle per lapis. Terlihat klaster yang tersambung di ≥2 lapis, sementara kejadian viral organik (hard negative) **tidak** ditandai.
3. **Dosir Kampanye**: rekonstruksi brief (T0 komando, seeder, talking points), bukti per lapis, sidik "urutan giliran".
4. **Data nyata**: tarik live dari X (pencarian isu) → analisis yang sama berjalan di data nyata (handle disamarkan).
5. **Perisai Nalar**: warga menempel pesan atau screenshot penipuan rekrutmen TNI AD → teknik manipulasi disorot, domain palsu terdeteksi, dan pesan dicocokkan dengan narasi aktif.
6. **Matriks Ketahanan**: angka P/R/F1 per jenis serangan + ablation (lapis tunggal gagal, multiplex berhasil).

### Gelombang 1: sampai submit 15 Nov (hanya yang ada di Jalur Emas)
- [ ] Monorepo + core: schema, sim (organik, viral organik, buzzer bayaran, bot farm, swarm LLM-like) + ground truth
- [ ] Lapis L1 (co-action), L2 (co-framing klaim), L4 (copypasta) **+ null-model** → graf → Louvain
- [ ] Forensik murah: T0/seeder/medoid (brief), urutan giliran, kisi
- [ ] SIE dengan interval + kontrafaktual "Tanpa Operasi"
- [ ] Collector X (GraphQL + transaction-id, queryId dinamis, rate limiter, cache SQLite) + impor JSON
- [ ] Perisai Nalar v1 (teknik, URL/impersonasi, cocok narasi; screenshot via DeepSeek)
- [ ] Eval + Matriks Ketahanan
- [ ] Web 5 halaman (Ruang Situasi, Peta Jaringan, Dosir, Perisai, Arena-eval) + mode publik (pseudonym, snapshot)
- [ ] Deploy publik, README, slide, video

### Gelombang 1.5: bila waktu tersisa sebelum 15 Nov
- [ ] Konten swarm dari agen DeepSeek berpersona (fixture)
- [ ] Collector YouTube (youtubei.js) + Cek Kolom Komentar
- [ ] Lapis L3 (ritme) dan L5 (siklus hidup akun)

### Gelombang 2: 16–24 Nov (persiapan final)
- [ ] Forensik change-point per akun, Breakout Scale, Titik Tembus
- [ ] Pemetaan DISARM + ekspor STIX 2.1 + paket bukti ber-hash (chain of custody)
- [ ] Kartu Vaksin Narasi + Cek Kolom Komentar untuk TikTok/IG
- [ ] Rute Narasi lintas platform + RSS berita
- [ ] Collector TikTok/Instagram/Facebook (browser + intersepsi) + ASR/sidik media
- [ ] Arena: mode latihan analis
- [ ] **Red Team Adaptif** (kurva biaya penghindaran)
- [ ] Validasi pada data operasi Papua (bila arsip Twitter IO bisa diakses) + data kontrol IU

---

## 7. Risiko & kejujuran

| Risiko | Mitigasi |
|---|---|
| Data sintetis dianggap "terlalu mudah" | Sertakan hard negative (viral organik) dan swarm parafrase. Tampilkan juga kegagalan detektor lapis tunggal (ablation). |
| Klaim TNI AD atau orang nyata | Semua narasi demo fiktif dan ditandai **SIMULASI**. Tidak ada akun atau orang nyata. |
| Domain atau kanal resmi TNI AD | Diverifikasi dulu sebelum dimasukkan ke registri. Tidak boleh mengarang. |
| Kode taktik DISARM | Diambil dari repo resmi DISARMframeworks, tidak ditulis dari ingatan. |
| Waktu | Gelombang 1 dikunci. Fitur Gelombang 2 tidak boleh mengganggu stabilitas link yang sudah disubmit. |
| Stealth UI tidak cocok dengan bundler Bun | Uji satu komponen di awal. Fallback ke shadcn standar. |
| False positive pada peristiwa viral organik | Null-model (A2), syarat ≥2 lapis, hard negative wajib lolos di eval |
| Pencemaran nama baik (UU ITE) di demo publik | Pseudonymisasi + bahasa "indikasi pola terkoordinasi" (A7) |
| Sesi X terkunci di hari-H | Snapshot data nyata disimpan sebelum rekaman video; demo tidak bergantung pada koleksi live (A8/A9) |
| Kredensial (key DeepSeek, cookie X) bocor | Hanya di `.env` (gitignored), tidak pernah dikirim ke klien. **Rotasi setelah hackathon.** |

---

## Referensi riset
- Kartika Cyber Hackathon — https://kartikacyberhackathon.id/
- Multiplex coordination, time-decay (Iannucci 2025) — https://fabiogiglietto.github.io/fg-zettelkasten/Papers/Iannucci2025-eg
- Multimodal coordination network — https://arxiv.org/html/2507.12108v3
- Uncovering coordinated networks (Pacheco et al.) — https://arxiv.org/abs/2107.02588
- Masalah time-window — https://link.springer.com/article/10.1007/s42001-024-00260-z
- Emergent coordination LLM agents (USC ISI, WWW '26) — https://arxiv.org/abs/2510.25003
- Breaking & defending LLM bot detection — https://arxiv.org/abs/2608.15893
- Swarm AI & synthetic consensus — https://phys.org/news/2026-02-swarms-ai-bots-sway-people.html
- Breakout Scale (Nimmo, Brookings) — https://www.brookings.edu/articles/the-breakout-scale-measuring-the-impact-of-influence-operations/
- DISARM & CTI interop — https://arxiv.org/pdf/2502.20997
- NATO SAS-185 Cognitive Warfare I&W — https://www.muni.cz/vyzkum/publikace/2491917
- Changed-hands accounts — https://arxiv.org/abs/2106.15352
- Ekonomi buzzer Indonesia (Kompas 2025) — https://www.kompas.id/artikel/uang-miliaran-rupiah-mengalir-ke-rekening-buzzer-2-2 ; perangkat buzzer — https://www.kompas.id/artikel/en-membongkar-senjata-buzzer-saat-beraksi-di-media-sosial
- Kasus Kejagung 150 buzzer — https://www.tempo.co/hukum/kejagung-ungkap-modus-pengerahan-150-buzzer-untuk-menghalangi-penyidikan-1374281
- Prebunking/inoculation (Bad Vaxx 2025, World Bank WhatsApp trial) — https://link.springer.com/10.1038/s41598-023-43885-2 ; https://openknowledge.worldbank.org/bitstreams/e8785f76-a930-4922-bc80-c8bd8b2efda1/download
- multilingual-e5-small ONNX — https://huggingface.co/Xenova/multilingual-e5-small
- Digital 2026 Indonesia — https://datareportal.com/reports/digital-2026-indonesia ; https://wearesocial.com/id/blog/2025/11/digital-2026-top-digital-and-social-media-trends-in-indonesia/
- X API pay-per-use (pihak ketiga) — https://postproxy.dev/blog/x-api-pricing-2026/ ; https://opentweet.io/x-api-pricing
- TikTok Research API — https://developers.tiktok.com/products/research-api/
- CIB di TikTok (ICWSM, Luceri dkk.) — https://arxiv.org/abs/2505.10867
- Meta Content Library — https://developers.facebook.com/docs/content-library-api/get-access ; Threads keyword search — https://developers.facebook.com/documentation/threads/keyword-search
- YouTube coordinated commenter mobs (COSMOS) — https://cosmos.ualr.edu/hot-off-the-press-developing-a-network-centric-approach-for-anomalous-behavior-detection-on-youtube/
- Telegram forwarding & TeleScope — https://ojs.aaai.org/index.php/ICWSM/article/download/31336/33496 ; https://arxiv.org/html/2504.19536v1
- Tipline WhatsApp (Meedan, Mafindo) — https://meedan.com/project/cryptochat ; https://meedan.org/post/indonesia-election-2024-corruption-surveillance-among-top-narratives-on-whatsapp ; https://arxiv.org/pdf/2106.04726
- Dataset hoaks NLP-BRIN (TurnBackHoax) — https://huggingface.co/datasets/nlp-brin-id/id-hoax-report-merge
- Repurposed accounts (ICWSM) — https://ojs.aaai.org/index.php/ICWSM/article/download/22139/21918/26202
- UU PDP & pengecualian Pasal 15 — https://www.hukumonline.com/berita/a/mk--uu-pdp-lindungi-pemrosesan-data-privat-bersifat-nonkomersil-lt6454b8bc84511?page=all
- Rekrutmen TNI AD resmi & penipuan — https://kabar24.bisnis.com/read/20260107/243/1942271/syarat-dan-cara-daftar-rekrutmen-tni-ad-2026-simak-beserta-jadwalnya ; https://www.metrotvnews.com/read/b3JCpAVL-korban-penipuan-rekrutmen-tni-di-kulon-progo-rugi-rp310-juta-tiga-pelaku-ditangkap
- Unofficial X (twscrape changelog, rate-limit PR, issues) — https://github.com/vladkens/twscrape/blob/main/changelog.md ; https://github.com/vladkens/twscrape/pull/364 ; https://github.com/vladkens/twscrape/issues/351
- Status scraper X 2026 (vendor, perlu verifikasi) — https://twitterapi.io/blog/twscrape ; https://www.xpoz.ai/blog/guides/open-source-social-media-scrapers-what-still-works-2026/
- TikTok signing (riset/RE) — https://github.com/carcabot/tiktok-xgnarly-decoded ; https://github.com/JWally/dfp-redteam-tiktok-web ; npm tiktok-signature — https://libraries.io/npm/tiktok-signature
- Instagram: instagrapi vs instaloader — https://subzeroid.github.io/blog/instagrapi-vs-instaloader/ ; Instaloader (Bellingcat) — https://bellingcat.gitbook.io/toolkit/more/all-tools/instaloader
- YouTube.js / PO Token — https://ytjs.dev/api/classes/Innertube ; https://github.com/yt-dlp/yt-dlp/wiki/PO-Token-Guide ; https://github.com/luanrt/bgutils
- Buzzer per platform Pemilu 2024 — https://repository.ub.ac.id/id/eprint/240867/ ; https://www.penabudaya.com/timrshunpadteliti-peran-buzzerpolitik/ ; https://opini.kemenkeu.go.id/article/read/buzzer-dan-media-sosial-perang-informasi-yang-tak-terlihat-
- x-client-transaction-id (npm/JSR, Bun) — https://jsr.io/@lami/x-client-transaction-id/doc ; https://socket.dev/npm/package/x-client-transaction-id
- Synchronized Action Framework (popularity weighting) — https://arxiv.org/pdf/2105.07454
- Temporal, multiplex & collaborative coordination detection — https://arxiv.org/pdf/2512.19677
- Inter-state IO claims vs control data (WWW 2025) — https://arxiv.org/html/2502.17344v1
- Labeled datasets for IO research (IU) — https://arxiv.org/html/2411.10609v2
- Operasi informasi Papua: Bellingcat — https://bellingcat.com/news/rest-of-world/2019/10/11/investigating-information-operations-in-west-papua-a-digital-forensic-case-study-of-cross-platform-network-analysis ; ASPI — https://www.aspistrategist.org.au/australia-uk-and-un-dragged-into-information-operations-targeting-west-papua/ ; https://infoops.aspi.org.au/country/indonesia/ ; HKS Misinformation Review — https://misinforeview.hks.harvard.edu/article/a-pro-government-disinformation-campaign-on-indonesian-papua
- Meta threat disruptions (CIB Indonesia 2019, 2020; mass-reporting 2022) — https://transparency.meta.com/metasecurity/threat-reporting/
