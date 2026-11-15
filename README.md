<div align="center">

<img src="https://raw.githubusercontent.com/pajarori/cakranala/main/web/src/icons/favicon.svg" width="72" alt="">

# Cakra Nala

Deteksi operasi pengaruh terkoordinasi dari ketergantungan antar akun.

[![npm](https://img.shields.io/npm/v/cakranala?style=flat&logo=npm&color=CB3837)](https://www.npmjs.com/package/cakranala)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![Stars](https://img.shields.io/github/stars/pajarori/cakranala?style=flat&logo=github)](https://github.com/pajarori/cakranala/stargazers)
[![Last Commit](https://img.shields.io/github/last-commit/pajarori/cakranala?style=flat&logo=github)](https://github.com/pajarori/cakranala/commits/main)

</div>

<p align="center">
  <img src="https://raw.githubusercontent.com/pajarori/cakranala/main/docs/assets/dashboard.png" alt="Dashboard Cakra Nala" width="900">
</p>

Cakra Nala menemukan buzzer, bot farm dan swarm LLM dengan mengukur seberapa sering akun bergerak bersama melebihi peluang, lalu menghitung berapa suara independen yang sebenarnya ada di balik sebuah narasi. Tersedia sebagai library dan dashboard operasi untuk X, YouTube, Telegram, TikTok, Instagram dan Facebook. Cara kerjanya ada di [docs/how-it-works.md](docs/how-it-works.md).

## Instalasi

```bash
bun install -g cakranala
```

Butuh [Bun](https://bun.sh) 1.2 atau lebih baru. Untuk library saja: `npm install cakranala`.

## Pemakaian

```bash
# Siapkan model e5, Typst untuk PDF, dan Chrome untuk Instagram/Facebook
cakranala install

# Jalankan dashboard di http://localhost:3000
cakranala serve

# Dengan skenario demo Pulau Seruni
cakranala serve --demo

# Cek fitur yang siap
cakranala doctor
```

Sebagai library:

```js
import { analyze } from "cakranala";

const report = await analyze(dataset);
report.narratives.map((n) => [n.sample, n.supporters, n.sie.value]);
```

### Opsi

| Flag | Keterangan |
|---|---|
| `-p, --port` | Port dashboard (default: 3000) |
| `-d, --data` | Folder data (default: `./.cakranala`) |
| `--demo` | Putar skenario fiktif Pulau Seruni |

Kasus yang sudah dikonfirmasi bisa dilaporkan ke platform dan Komdigi dengan satu tombol, lihat bagian Aduan di [docs/platforms.md](docs/platforms.md).

Model bahasa diatur lewat `LLM_BASE_URL`, `LLM_MODEL` dan `LLM_API_KEY` (endpoint kompatibel OpenAI, opsional). Kredensial platform dan proxy diatur dari dashboard, lihat [docs/platforms.md](docs/platforms.md).

## Docker

```bash
docker compose up -d --build
```

## Lisensi

Apache License 2.0
