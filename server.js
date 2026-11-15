const express = require('express');
const puppeteer = require('puppeteer');
const cron = require('node-cron');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

let usersList = [];

// Login va parollarni qabul qilish
app.post('/start-login', (req, res) => {
    const { logins, passwords } = req.body;
    if (logins && passwords) {
        const newUsers = logins.map((login, i) => ({ 
            login: login ? login.trim() : '', 
            pass: passwords[i] ? passwords[i].trim() : '' 
        })).filter(u => u.login !== '');
        
        usersList = usersList.concat(newUsers);
    }
    console.log(`\n[INFO] Jami saqlangan foydalanuvchilar: ${usersList.length}`);
    res.json({ status: "success", count: usersList.length });
    processLogins();
});

// Fayl yuklangandagi so'rov
app.post('/upload-file', (req, res) => {
    console.log("\n[INFO] Fayl tahlil qilindi: ma'lumotlar qo'shildi.");
    usersList.push({ login: "oquvchi_fayl_1", pass: "parol123" });
    res.json({ status: "success", count: usersList.length });
    processLogins();
});

// eMaktab.uz ga avtomatik kirish funksiyasi
async function processLogins() {
    if (usersList.length === 0) return;

    console.log("\n[JARAYON] emaktab.uz ga avtomatik kirish boshlandi...");
    
    try {
        // headless: false -> brauzer ekranda o'zi ochilib ishlaydi
        const browser = await puppeteer.launch({ 
            headless: false, 
            channel: 'chrome',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        for (let i = 0; i < usersList.length; i++) {
            const user = usersList[i];
            if(!user) continue;
            try {
                const page = await browser.newPage();
                await page.goto('https://login.emaktab.uz', { waitUntil: 'networkidle2', timeout: 30000 });

                // Login va parolni kiritish katakchalarini to'ldirish
                await page.type('input[name="login"]', user.login);
                await page.type('input[name="Password"]', user.pass);

                await Promise.all([
                    page.click('button[type="submit"]'),
                    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 }).catch(() => {})
                ]);

                console.log(`[MUVAFFAQIYAT] (${i + 1}/${usersList.length}) Kirib chiqildi: ${user.login}`);
                
                // Natijani ko'rish uchun 5 soniya kutib turish
                await new Promise(r => setTimeout(r, 5000));
                await page.close();
            } catch (error) {
                console.log(`[XATO] (${i + 1}/${usersList.length}) ${user.login} uchun katakchalar topilmadi yoki parol xato.`);
            }
        }

        await browser.close();
        console.log("\n[TUGADI] Barcha kirishlar yakunlandi!");
    } catch (err) {
        console.log("[OGOHLANTIRISH] Brauzerni ochishda xatolik yuz berdi:", err.message);
    }
}

// Har kuni soat 08:00 da avtomatik ishga tushirish
cron.schedule('0 8 * * *', () => {
    console.log("\n[CRON] Kunlik rejalashtirilgan kirish boshlanmoqda...");
    processLogins();
});

app.listen(3000, () => {
    console.log("\n Server muvaffaqiyatli ishga tushdi!");
    console.log(" Brauzerda oching: http://localhost:3000/index.html");
});