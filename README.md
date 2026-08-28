# Zeytinburnu Belediyesi Web Site Kontrol Sistemi

Zeytinburnu Belediyesi bünyesinde kullanılan web sitelerinin erişilebilirlik durumunu ve cevap sürelerini kontrol etmek amacıyla geliştirilmiş web tabanlı bir site kontrol sistemidir.

## Özellikler

- 20 farklı web sitesini kontrol eder.
- Siteleri eş zamanlı olarak kontrol eder.
- HTTP durum kodunu gösterir.
- Cevap süresini milisaniye cinsinden gösterir.
- Çalışıyor, Yavaş, Zaman Aşımı ve Ulaşılamıyor durumlarını gösterir.
- Her site için son 10 ölçümü saklar.
- Ölçüm geçmişini SQLite veritabanında tutar.
- Canlı kontrol sırasında ilerleme durumunu gösterir.
- Türkçe karakter destekli site isimleri kullanır.

## Kullanılan Teknolojiler

- HTML
- CSS
- JavaScript
- Node.js
- Express.js
- SQLite
- better-sqlite3

## Çalıştırma

Projeyi bilgisayara indirdikten sonra proje klasöründe terminal açılır.

Gerekli paketler:
```bash
npm install
```

Sunucuyu başlatmak için:

```bash
node server.js
```

Daha sonra tarayıcıdan:

```text
http://127.0.0.1:3001
```

adresine gidilir.

## Proje Yapısı

- `index.html` — Kullanıcı arayüzü
- `server.js` — Sunucu ve site kontrol işlemleri
- `logo.jpg` — Belediye logosu
- `package.json` — Proje bilgileri ve bağımlılıklar
- `package-lock.json` — Paket sürüm bilgileri

## Geliştirici

Zeytinburnu Belediyesi web site kontrol projesi.
