# Cara kerja

Engine membangun graf ketergantungan antar akun dari lima layer bukti:

| Layer | Sinyal |
|---|---|
| Co-action | Membalas, mengutip, membagikan URL atau tagar yang sama dalam 15 menit |
| Semantic co-framing | Makna sama dengan kata berbeda, lewat embedding e5 multibahasa |
| Copypasta | Teks hampir identik, lewat n-gram karakter, MinHash dan LSH |
| Rhythm | Jam aktif yang sama melebihi peluang |
| Account lifecycle | Akun dibuat di hari yang sama dengan pola nama serupa |

Setiap layer dibandingkan dengan null model yang dibangun dari data itu sendiri. Interaksi diacak di dalam strata waktu pendek, sehingga berita besar yang memicu banyak akun sekaligus tidak dianggap koordinasi. Hitungan pasangan diuji dengan ekor negative binomial, lalu layer digabung dengan Cauchy combination dan partial conjunction.

Ambang klaster dipilih dari data agar decoy FDR tetap di bawah 5 persen, dan setiap klaster harus lolos uji permutasi. Verdict narasi memakai klaster yang ditemukan di separuh waktu lainnya, jadi data yang sama tidak menemukan sekaligus memvonis.

Dukungan sebuah narasi dihitung sebagai suara independen efektif (SIE):

```
SIE = organik + Σ n_c / (1 + (n_c − 1) · ρ_c)
```

dengan `n_c` jumlah akun di klaster `c` dan `ρ_c` korelasi di dalamnya.

Layer semantic co-framing aktif kalau `@huggingface/transformers` terpasang (`cakranala install` mengurusnya). Tanpa itu engine berjalan dengan empat layer.

## Akurasi

Diuji pada arsip berlabel operasi pengaruh negara yang nyata. Peringkat akun mencapai average precision 0,76 dan 0,94, dibanding 0,22 dan 0,75 kalau akun hanya diurutkan berdasarkan jumlah post. Tidak ada akun kontrol yang masuk klaster, dan tidak ada klaster yang muncul pada data yang waktunya digeser. Pada simulasi, bot farm dan buzzer bayaran hampir semua tertangkap tanpa akun organik ikut ditandai. Swarm LLM yang sabar masih kasus tersulit.

## Data dan privasi

Hanya data publik yang dikumpulkan, dan handle diganti pseudonim HMAC sebelum disimpan. Hasil deteksi adalah indikasi pola perilaku terkoordinasi, bukan tuduhan terhadap individu. Setiap perubahan di dashboard tercatat di audit log yang setiap entrinya memuat hash SHA-256 entri sebelumnya.
