# Platform

Target yang bisa dipantau:

| Platform | topic | account | post | Kredensial |
|---|---|---|---|---|
| X | pencarian | balasan dan mention ke akun | satu percakapan dan profil akun yang me-repost | wajib |
| YouTube | komentar video hasil pencarian | | komentar satu video | opsional |
| Telegram | | kanal publik, forward dilacak ke sumbernya | | tidak perlu |
| TikTok | komentar video hasil pencarian | | komentar satu video | wajib, lewat sidecar |
| Instagram | post di bawah hashtag | post sebuah akun | satu post | wajib |
| Facebook | pencarian post | post sebuah Page | satu post | wajib |

Data juga bisa diimpor dari CSV arsip transparansi X atau dataset JSON Cakra Nala di `/monitors/import`.

## Kredensial

Kredensial diatur di `/credentials`, tidak lewat environment. Setiap kredensial dienkripsi AES-GCM dengan kunci di `credential.key` di folder data, jadi cadangkan kunci itu bersama database.

Saat disimpan, kredensial langsung diuji dan akun di baliknya ditampilkan. Kolektor memakai kredensial yang paling lama tidak dipakai, mengistirahatkannya sampai rate limit selesai, lalu pindah ke kredensial berikutnya. Setelah tiga kali gagal berturut-turut, kredensial dimatikan. Checkpoint atau CAPTCHA dari platform tidak dilewati otomatis; kredensial ditandai gagal dan operator memverifikasinya sendiri.

| Platform | Isi |
|---|---|
| X | cookie `auth_token` dan `ct0`, plus user agent |
| YouTube | cookie, opsional |
| TikTok | header cookie lengkap termasuk `ttwid`, plus user agent persis dari browser asalnya |
| Instagram, Facebook | header cookie lengkap dari sesi yang sudah login, plus user agent persis dari browser asalnya |

Pakai akun khusus untuk Instagram dan Facebook. Meta membatasi akun yang mengumpulkan data dalam jumlah besar.

## Instagram dan Facebook

Meta tidak menyediakan akses baca publik yang cocok untuk analisis koordinasi, jadi keduanya dibaca lewat Chrome sungguhan yang dipasang oleh `cakranala install`. Setiap pengumpulan membuka browser context terpisah dengan cookie, user agent dan proxy milik sesi itu. Data diambil dari data awal halaman dan respons GraphQL yang dimuat halaman saat di-scroll, sehingga tidak bergantung pada query id atau endpoint REST yang sering berubah.

## TikTok

TikTok dikumpulkan lewat sidecar [Douyin_TikTok_Download_API](https://github.com/Evil0ctal/Douyin_TikTok_Download_API) (Apache 2.0). Isi `.env`:

```
TIKTOK_SIDECAR_URL=http://tiktok:8000
TIKTOK_SIDECAR_PASSWORD=...
TIKTOK_SECRET_KEY=...   # minimal 32 karakter
TIKTOK_DB_PASSWORD=...
```

lalu jalankan `docker compose --profile tiktok up -d --build`. Setiap kredensial TikTok di vault diimpor ke sidecar sekali, dan permintaan diteruskan lewat sidecar.

## Proxy

Proxy adalah satu daftar bersama di `/credentials/proxies`, dipakai X, YouTube, Instagram dan Facebook. TikTok memakai jaringan sidecar. Tempel banyak proxy sekaligus, satu per baris:

```
http://user:pass@203.0.113.10:8080
203.0.113.11:8080:user:pass
203.0.113.12:3128
```

Setiap sesi diikat ke satu proxy, yang paling sedikit dipakai, supaya akun selalu muncul dari alamat yang sama. Uji proxy menampilkan IP keluar dan negaranya. Kalau pengumpulan gagal di level jaringan, kegagalan dicatat ke proxy, bukan ke akun: sesi pindah ke proxy lain dan mencoba sekali lagi. Proxy dimatikan setelah tiga kali gagal. Kalau ada proxy tetapi tidak ada yang aktif, pengumpulan berhenti dan tidak jatuh ke alamat server.
