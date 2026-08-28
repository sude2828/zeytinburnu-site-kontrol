const Database = require("better-sqlite3");
const express = require("express");
const https = require("https");
const http = require("http");

const app = express();

const PORT = process.env.PORT || 3001;

const db = new Database("site-kontrol.db");


// ==================================================
// SİTELER
// ==================================================

const siteler = [
    {
        ad: "Zeytinburnu Belediyesi",
        url: "https://zeytinburnu.istanbul/"
    },
    {
        ad: "Ömer Arsoy",
        url: "https://omerarisoy.com.tr/"
    },
    {
        ad: "Kariyer Merkezi",
        url: "https://zeytinburnukariyermerkezi.com/"
    },
    {
        ad: "Gençlik Merkezi",
        url: "https://zeygem.org.tr/"
    },
    {
        ad: "Bilgi Evi",
        url: "https://bilgievi.org.tr/"
    },
    {
        ad: "Zeytinburnu Kültür Sanat",
        url: "https://zeytinburnukultursanat.com/"
    },
    {
        ad: "Akdem",
        url: "https://akdem.org.tr/"
    },
    {
        ad: "Kültür Vadisi",
        url: "https://kulturvadisi.com/"
    },
    {
        ad: "Beyond The Wall",
        url: "https://beyondthewalls.ist/"
    },
    {
        ad: "Millet Kıraathaneleri",
        url: "https://milletkiraathanesi.org.tr/"
    },
    {
        ad: "Kazlıçeşme Sanat",
        url: "https://kazlicesmesanat.com/"
    },
    {
        ad: "Bilim Zeytinburnu",
        url: "https://bilimzeytinburnu.org/"
    },
    {
        ad: "Zeytinburnu Kitapçısı",
        url: "https://zeytinburnukitapcisi.com/"
    },
    {
        ad: "Vatandaş Zeybim",
        url: "https://vatandas.zeybim.com/"
    },
    {
        ad: "Z Dergisi",
        url: "https://zdergisi.com/"
    },
    {
        ad: "Sayısal Online İşlemler",
        url: "https://webportal.zeytinburnu.bel.tr/"
    },
    {
        ad: "Platform Zeytinburnu",
        url: "https://platformzeytinburnu.com/"
    },
    {
        ad: "Geleceğin Ustaları",
        url: "https://geleceginustalari.ist/"
    },
    {
        ad: "Doğru İşlerin Belediyesi",
        url: "https://dogruislerinbelediyesi.com/"
    },
    {
        ad: "Afet Zeytinburnu",
        url: "https://afet.zeytinburnu.istanbul/"
    }
];


// ==================================================
// VERİTABANI
// ==================================================

db.prepare(`
    CREATE TABLE IF NOT EXISTS olcumler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL,
        sure INTEGER,
        durum INTEGER,
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();


// ==================================================
// STATİK DOSYALAR
// ==================================================

app.use(express.static(__dirname));


// ==================================================
// SİTELER
// ==================================================

app.get("/siteler", (req, res) => {
    res.json(siteler);
});


// ==================================================
// GEÇMİŞ ÖLÇÜMLER
// ==================================================

app.get("/gecmis", (req, res) => {

    const sonuclar = [];

    for (const site of siteler) {

        const olcumler = db.prepare(`
            SELECT sure, durum, tarih
            FROM olcumler
            WHERE site = ?
            ORDER BY id DESC
            LIMIT 10
        `).all(site.url);

        sonuclar.push({
            ad: site.ad,
            url: site.url,
            olcumler: olcumler
        });
    }

    res.json(sonuclar);
});


// ==================================================
// HTTPS / HTTP KONTROLÜ
// ==================================================

function siteIste(siteUrl, redirectSayisi = 0) {

    return new Promise((resolve, reject) => {

        if (redirectSayisi > 5) {
            reject(new Error("Çok fazla yönlendirme"));
            return;
        }

        let url;

        try {
            url = new URL(siteUrl);
        } catch (hata) {
            reject(new Error("Geçersiz site adresi"));
            return;
        }

        const protokol =
            url.protocol === "https:"
                ? https
                : http;

        const baslangic = Date.now();

        const istek = protokol.request(
            url,
            {
                method: "GET",

                timeout: 20000,

                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

                    "Accept":
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                    "Connection":
                        "close"
                }
            },

            cevap => {

                const sure =
                    Date.now() - baslangic;

                // Yönlendirme varsa takip et
                if (
                    cevap.statusCode >= 300 &&
                    cevap.statusCode < 400 &&
                    cevap.headers.location
                ) {

                    const yeniAdres =
                        new URL(
                            cevap.headers.location,
                            url
                        ).toString();

                    cevap.resume();

                    siteIste(
                        yeniAdres,
                        redirectSayisi + 1
                    )
                    .then(resolve)
                    .catch(reject);

                    return;
                }

                // Cevabın tamamını tüket
                cevap.resume();

                resolve({
                    durum: cevap.statusCode,
                    sure: sure
                });
            }
        );

        istek.on("timeout", () => {

            istek.destroy(
                new Error(
                    "20 saniye içinde cevap alınamadı"
                )
            );
        });

        istek.on("error", hata => {

            reject(hata);
        });

        istek.end();
    });
}


// ==================================================
// TEK SİTE KONTROLÜ
// ==================================================

async function siteKontrolEt(site) {

    try {

        const sonuc =
            await siteIste(site.url);

        db.prepare(`
            INSERT INTO olcumler
            (site, sure, durum)
            VALUES (?, ?, ?)
        `).run(
            site.url,
            sonuc.sure,
            sonuc.durum
        );

        console.log(
            "✅ " +
            site.ad +
            " → HTTP " +
            sonuc.durum +
            " → " +
            sonuc.sure +
            " ms"
        );

        return {

            ad: site.ad,

            url: site.url,

            durum: sonuc.durum,

            sure: sonuc.sure,

            hata: null
        };

    } catch (hata) {

        let hataMesaji =
            "Siteye ulaşılamadı";

        if (hata.code === "ENOTFOUND") {

            hataMesaji =
                "Site adresi bulunamadı";

        } else if (hata.code === "ECONNREFUSED") {

            hataMesaji =
                "Bağlantı reddedildi";

        } else if (hata.code === "ECONNRESET") {

            hataMesaji =
                "Bağlantı karşı taraf tarafından kapatıldı";

        } else if (hata.code === "ETIMEDOUT") {

            hataMesaji =
                "Bağlantı zaman aşımına uğradı";

        } else if (
            hata.message &&
            hata.message.includes("20 saniye")
        ) {

            hataMesaji =
                "20 saniye içinde cevap vermedi";

        } else if (hata.message) {

            hataMesaji =
                hata.message;
        }

        console.log(
            "❌ " +
            site.ad +
            " → " +
            hataMesaji
        );

        db.prepare(`
            INSERT INTO olcumler
            (site, sure, durum)
            VALUES (?, ?, ?)
        `).run(
            site.url,
            null,
            0
        );

        return {

            ad: site.ad,

            url: site.url,

            durum: "Ulaşılamadı",

            sure: null,

            hata: hataMesaji
        };
    }
}


// ==================================================
// TÜM SİTELER
// ==================================================

app.get("/tum-siteler", async (req, res) => {

    try {

        const sonuclar =
            await Promise.all(
                siteler.map(site =>
                    siteKontrolEt(site)
                )
            );

        res.json(sonuclar);

    } catch (hata) {

        console.log(
            "Genel kontrol hatası:",
            hata
        );

        res.status(500).json({
            hata:
                "Siteler kontrol edilirken hata oluştu."
        });
    }
});


// ==================================================
// CANLI KONTROL
// ==================================================

app.get(
    "/tum-siteler-canli",
    async (req, res) => {

        res.setHeader(
            "Content-Type",
            "text/event-stream"
        );

        res.setHeader(
            "Cache-Control",
            "no-cache"
        );

        res.setHeader(
            "Connection",
            "keep-alive"
        );

        if (res.flushHeaders) {
            res.flushHeaders();
        }

        const toplam =
            siteler.length;

        let tamamlanan = 0;

        const kontroller =
            siteler.map(async site => {

                const sonuc =
                    await siteKontrolEt(site);

                tamamlanan++;

                res.write(
                    `data: ${JSON.stringify({

                        ad: sonuc.ad,

                        url: sonuc.url,

                        durum: sonuc.durum,

                        sure: sonuc.sure,

                        hata: sonuc.hata,

                        tamamlanan:
                            tamamlanan,

                        toplam:
                            toplam

                    })}\n\n`
                );
            });

        await Promise.all(kontroller);

        res.write(
            `data: ${JSON.stringify({

                tamamlandi: true,

                toplam: toplam

            })}\n\n`
        );

        res.end();
    }
);


// ==================================================
// TEK KONTROL
// ==================================================

app.get("/kontrol", async (req, res) => {

    try {

        const site =
            siteler[0];

        const sonuc =
            await siteKontrolEt(site);

        res.json({

            site:
                sonuc.url,

            durum:
                sonuc.durum,

            sure:
                sonuc.sure,

            hata:
                sonuc.hata
        });

    } catch (hata) {

        console.log(
            "Kontrol hatası:",
            hata
        );

        res.status(500).json({

            hata:
                "Kontrol sırasında hata oluştu."
        });
    }
});


// ==================================================
// ANA SAYFA
// ==================================================

app.get("/", (req, res) => {

    res.sendFile(
        __dirname + "/index.html"
    );
});


// ==================================================
// SUNUCU
// ==================================================

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `SUNUCU ${PORT} AÇIK`
        );

        console.log(
            `Web sitesi hazır`
        );
    }
);