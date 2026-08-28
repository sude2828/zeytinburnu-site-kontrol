const Database = require("better-sqlite3");
const express = require("express");

const db = new Database("site-kontrol.db");
const app = express();

const PORT = 3001;

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

db.prepare(`
    CREATE TABLE IF NOT EXISTS olcumler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        site TEXT NOT NULL,
        sure INTEGER,
        durum INTEGER,
        tarih DATETIME DEFAULT CURRENT_TIMESTAMP
    )
`).run();

app.use(express.static(__dirname));

app.get("/siteler", (req, res) => {
    res.json(siteler);
});

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

async function siteKontrolEt(site) {

    const baslangic = Date.now();

    const kontrolAbort = new AbortController();

    const zamanAsimi = setTimeout(() => {
        kontrolAbort.abort();
    }, 20000);

    try {

        const cevap = await fetch(site.url, {
            signal: kontrolAbort.signal
        });

        clearTimeout(zamanAsimi);

        const sure = Date.now() - baslangic;

        db.prepare(`
            INSERT INTO olcumler (site, sure, durum)
            VALUES (?, ?, ?)
        `).run(
            site.url,
            sure,
            cevap.status
        );

        return {
            ad: site.ad,
            url: site.url,
            durum: cevap.status,
            sure: sure,
            hata: null
        };

    } catch (hata) {

        clearTimeout(zamanAsimi);

        let hataMesaji = "Bilinmeyen hata";

        if (hata.name === "AbortError") {

            hataMesaji =
                "20 saniye içinde cevap vermedi";

        } else if (hata.code === "ENOTFOUND") {

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
            INSERT INTO olcumler (site, sure, durum)
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

app.get("/tum-siteler", async (req, res) => {

    try {

        const sonuclar = await Promise.all(
            siteler.map(site => siteKontrolEt(site))
        );

        res.json(sonuclar);

    } catch (hata) {

        console.log("Genel kontrol hatası:", hata);

        res.status(500).json({
            hata: "Siteler kontrol edilirken hata oluştu."
        });
    }
});

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
                tamamlanan: tamamlanan,
                toplam: toplam
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
});

app.get("/kontrol", async (req, res) => {

    const site = siteler[0];

    const sonuc =
        await siteKontrolEt(site);


    res.json({
        site: sonuc.url,
        durum: sonuc.durum,
        sure: sonuc.sure,
        hata: sonuc.hata
    });
});

app.get("/", (req, res) => {

    res.sendFile(
        __dirname + "/index.html"
    );

});

app.listen(
    PORT,
    "127.0.0.1",
    () => {

        console.log(
            "SUNUCU 3001 AÇIK"
        );

    }
);