const express = require('express');
const app = express();
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
const YOUR_ID = '8467166855';
let reminders = [];

app.get('/', (req, res) => {
    res.send('🚀 Bot works!');
});

app.get('/keep-alive', (req, res) => {
    res.send('alive');
});

app.post('/add-reminder', (req, res) => {
    const { text, date, time } = req.body;
    const [y,m,d] = date.split('-');
    const [h,min] = time.split(':');
    reminders.push({
        text, date, time,
        timestamp: new Date(y,m-1,d,h,min).getTime(),
        sent: false
    });
    console.log(`📝 Напоминание: ${text} на ${date} ${time}`);
    res.json({ success: true });
});

app.post('/add-task', (req, res) => {
    console.log('📝 Задача:', req.body);
    res.json({ success: true });
});

async function sendToTelegram(message) {
    if (!BOT_TOKEN) return false;
    try {
        const https = require('https');
        const data = JSON.stringify({
            chat_id: YOUR_ID,
            text: message,
            parse_mode: 'HTML'
        });
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const urlObj = new URL(url);
        const req = https.request({
            hostname: urlObj.hostname,
            path: urlObj.pathname,
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        req.write(data);
        req.end();
        console.log('✅ Отправлено в Telegram');
        return true;
    } catch(e) {
        console.log('❌ Ошибка:', e.message);
        return false;
    }
}

setInterval(async () => {
    const now = Date.now();
    const toSend = reminders.filter(r => r.timestamp <= now && !r.sent);
    for (const r of toSend) {
        const msg = `🔔 НАПОМИНАНИЕ!\n\n📅 ${r.date}\n⏰ ${r.time}\n📝 ${r.text}`;
        await sendToTelegram(msg);
        r.sent = true;
    }
}, 60000);

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Сервер на порту ${port}`);
    console.log(`📡 /keep-alive доступен`);
});