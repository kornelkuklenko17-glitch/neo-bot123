const express = require('express');
const app = express();
app.use(express.json());

const NTFY_TOPIC = 'neon-reminder';
let reminders = [];

app.get('/', (req, res) => res.send('🚀 Bot works!'));
app.get('/keep-alive', (req, res) => res.send('alive'));

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

async function sendToNtfy(message) {
    try {
        const https = require('https');
        const url = `https://ntfy.sh/${NTFY_TOPIC}`;
        const urlObj = new URL(url);
        return new Promise((resolve) => {
            const req = https.request({
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' }
            });
            req.on('error', () => resolve(false));
            req.on('response', (res) => resolve(res.statusCode === 200));
            req.write(message);
            req.end();
        });
    } catch(e) { return false; }
}

setInterval(async () => {
    const now = Date.now();
    const toSend = reminders.filter(r => r.timestamp <= now && !r.sent);
    for (const r of toSend) {
        const msg = `🔔 НАПОМИНАНИЕ!\n\n${r.text}\n📅 ${r.date}\n⏰ ${r.time}`;
        const sent = await sendToNtfy(msg);
        if (sent) r.sent = true;
    }
}, 60000);

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Сервер на порту ${port}`));