const express = require("express");
const Database = require("better-sqlite3");
const http = require("http");
const https = require("https");
const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");

const app = express();
const PORT = process.env.PORT || 3001;

const db = new Database("site-kontrol.db");

const siteler = [
    { ad: "Zeytinburnu Belediyesi", url: "https://zeytinburnu.istanbul/" },
    { ad: "Ömer Arsoy", url: "https://omerarisoy.com.tr/" },
    { ad: "Kariyer Merkezi", url: "https://zeytinburnukariyermerkezi.com/" },
    { ad: "Gençlik Merkezi", url: "https://zeygem.org.tr/" },
    { ad: "Bilgi Evi", url: "https://bilgievi.org.tr/" },
    { ad: "Zeytinburnu Kültür Sanat", url: "https://zeytinburnukultursanat.com/" },
    { ad: "Akdem", url: "https://akdem.org.tr/" },
    { ad: "Kültür Vadisi", url: "https://kulturvadisi.com/" },
    { ad: "Beyond The Wall", url: "https://beyondthewalls.ist/" },
    { ad: "Millet Kıraathaneleri", url: "https://milletkiraathanesi.org.tr/" },
    { ad: "Kazlıçeşme Sanat", url: "https://kazlicesmesanat.com/" },
    { ad: "Bilim Zeytinburnu", url: "https://bilimzeytinburnu.org/" },
    { ad: "Zeytinburnu Kitapçısı", url: "https://zeytinburnukitapcisi.com/" },
    { ad: "Vatandaş Zeybim", url: "https://vatandas.zeybim.com/" },
    { ad: "Z Dergisi", url: "https://zdergisi.com/" },
    { ad: "Sayısal Online İşlemler", url: "https://webportal.zeytinburnu.bel.tr/" },
    { ad: "Platform Zeytinburnu", url: "https://platformzeytinburnu.com/" },
    { ad: "Geleceğin Ustaları", url: "https://geleceginustalari.ist/" },
    { ad: "Doğru İşlerin Belediyesi", url: "https://dogruislerinbelediyesi.com/" },
    { ad: "Afet Zeytinburnu", url: "https://afet.zeytinburnu.istanbul/" }
];


// --------------------------------------------------
// VERİTABANI
// --------------------------------------------------

db.prepare(`
    CREATE TABLE IF NOT EXISTS olcumler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL,
        sure INTEGER,
        durum INTEGER,
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();


// --------------------------------------------------
// STATİK DOSYALAR
// --------------------------------------------------

app.use(express.static(__dirname));


// --------------------------------------------------
// SİTELER
// --------------------------------------------------

app.get("/siteler", (req, res) => {
    res.json(siteler);
});


// --------------------------------------------------
// GEÇMİŞ
// --------------------------------------------------

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
            olcumler
        });
    }

    res.json(sonuclar);
});


// --------------------------------------------------
// SİTE KONTROL
// --------------------------------------------------

function siteKontrolEt(site, yonlendirmeSayisi = 0) {

    return new Promise((resolve) => {

        const baslangic = Date.now();

        let adres;

        try {
            adres = new URL(site.url);
        } catch (hata) {

            resolve({
                ad: site.ad,
                url: site.url,
                durum: "Ulaşılamadı",
                sure: null,
                hata: "Geçersiz URL"
            });

            return;
        }

        const istemci = adres.protocol === "https:"
            ? https
            : http;

        const istek = istemci.get(
            adres,
            {
                timeout: 15000,
                family: 4,

                headers: {
                    "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",

                    "Accept":
                        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                    "Connection": "close"
                }
            },

            (cevap) => {

                const sure = Date.now() - baslangic;

                // Yönlendirme varsa takip et
                if (
                    [301, 302, 303, 307, 308].includes(cevap.statusCode) &&
                    cevap.headers.location
                ) {

                    if (yonlendirmeSayisi >= 5) {

                        db.prepare(`
                            INSERT INTO olcumler
                            (site, sure, durum)
                            VALUES (?, ?, ?)
                        `).run(
                            site.url,
                            sure,
                            cevap.statusCode
                        );

                        resolve({
                            ad: site.ad,
                            url: site.url,
                            durum: cevap.statusCode,
                            sure,
                            hata: "Çok fazla yönlendirme"
                        });

                        return;
                    }

                    const yeniUrl = new URL(
                        cevap.headers.location,
                        adres
                    ).toString();

                    cevap.resume();

                    siteKontrolEt(
                        {
                            ad: site.ad,
                            url: yeniUrl
                        },
                        yonlendirmeSayisi + 1
                    ).then(resolve);

                    return;
                }

                cevap.resume();

                db.prepare(`
                    INSERT INTO olcumler
                    (site, sure, durum)
                    VALUES (?, ?, ?)
                `).run(
                    site.url,
                    sure,
                    cevap.statusCode || 0
                );

                resolve({
                    ad: site.ad,
                    url: site.url,
                    durum: cevap.statusCode || 0,
                    sure,
                    hata: null
                });
            }
        );


        // --------------------------------------------------
        // HATA
        // --------------------------------------------------

        istek.on("error", (hata) => {

            const sure = Date.now() - baslangic;

            let hataMesaji = "Bilinmeyen bağlantı hatası";

            if (hata.code === "ENOTFOUND") {
                hataMesaji = "DNS: Site adresi bulunamadı";
            }
            else if (hata.code === "ECONNREFUSED") {
                hataMesaji = "Bağlantı reddedildi";
            }
            else if (hata.code === "ECONNRESET") {
                hataMesaji = "Bağlantı karşı tarafça kapatıldı";
            }
            else if (hata.code === "ETIMEDOUT") {
                hataMesaji = "Bağlantı zaman aşımına uğradı";
            }
            else if (hata.code === "CERT_HAS_EXPIRED") {
                hataMesaji = "SSL sertifikasının süresi dolmuş";
            }
            else if (hata.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
                hataMesaji = "SSL sertifikası doğrulanamadı";
            }
            else if (hata.code === "EPROTO") {
                hataMesaji = "SSL/TLS bağlantı hatası";
            }
            else if (hata.message) {
                hataMesaji = hata.message;
            }

            console.log(
                `❌ ${site.ad} → ${hataMesaji}`
            );

            db.prepare(`
                INSERT INTO olcumler
                (site, sure, durum)
                VALUES (?, ?, ?)
            `).run(
                site.url,
                sure,
                0
            );

            resolve({
                ad: site.ad,
                url: site.url,
                durum: "Ulaşılamadı",
                sure,
                hata: hataMesaji
            });
        });


        // Timeout
        istek.setTimeout(15000, () => {

            istek.destroy(
                new Error("ETIMEDOUT")
            );

        });

    });
}


// --------------------------------------------------
// TÜM SİTELER
// --------------------------------------------------

app.get("/tum-siteler", async (req, res) => {

    try {

        const sonuclar = await Promise.all(
            siteler.map(site => siteKontrolEt(site))
        );

        res.json(sonuclar);

    } catch (hata) {

        console.error(
            "Genel kontrol hatası:",
            hata
        );

        res.status(500).json({
            hata: "Siteler kontrol edilirken hata oluştu."
        });
    }
});


// --------------------------------------------------
// CANLI KONTROL
// --------------------------------------------------

app.get("/tum-siteler-canli", async (req, res) => {

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

    const toplam = siteler.length;

    let tamamlanan = 0;

    const kontroller = siteler.map(async (site) => {

        const sonuc = await siteKontrolEt(site);

        tamamlanan++;

        res.write(
            `data: ${JSON.stringify({
                ad: sonuc.ad,
                url: sonuc.url,
                durum: sonuc.durum,
                sure: sonuc.sure,
                hata: sonuc.hata,
                tamamlanan,
                toplam
            })}\n\n`
        );
    });

    await Promise.all(kontroller);

    res.write(
        `data: ${JSON.stringify({
            tamamlandi: true,
            toplam
        })}\n\n`
    );

    res.end();
});


// --------------------------------------------------
// TEK SİTE KONTROLÜ
// --------------------------------------------------

app.get("/kontrol", async (req, res) => {

    try {

        const sonuc = await siteKontrolEt(
            siteler[0]
        );

        res.json({
            site: sonuc.url,
            durum: sonuc.durum,
            sure: sonuc.sure,
            hata: sonuc.hata
        });

    } catch (hata) {

        console.error(
            "Kontrol hatası:",
            hata
        );

        res.status(500).json({
            hata: "Kontrol sırasında hata oluştu."
        });
    }
});


// --------------------------------------------------
// ANA SAYFA
// --------------------------------------------------

app.get("/", (req, res) => {

    res.sendFile(
        __dirname + "/index.html"
    );
});


// --------------------------------------------------
// SUNUCU
// --------------------------------------------------

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `SUNUCU ${PORT} AÇIK`
        );

    }
);