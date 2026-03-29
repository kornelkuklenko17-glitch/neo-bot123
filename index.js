const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

// Устанавливаем часовой пояс Польши (GMT+2 - летнее время)
process.env.TZ = 'Europe/Warsaw';

const app = express();
app.use(cors());
app.use(express.json());

// ========== КОНФИГУРАЦИЯ ==========
const TELEGRAM_TOKEN = '8213575021:AAEU5WPKy9yMLJmly2jn1QI_zwlBmAq_pEQ';
const TELEGRAM_CHAT_ID = '8467166855';

// Хранилище напоминаний
let reminders = [];
let reminderId = 1;

// ========== ФУНКЦИЯ ОТПРАВКИ В TELEGRAM ==========
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
    
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'HTML'
            })
        });
        
        const data = await response.json();
        
        if (data.ok) {
            console.log(`✅ [${new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}] Сообщение отправлено`);
            return { success: true };
        } else {
            console.error(`❌ Ошибка Telegram: ${data.description}`);
            return { success: false, error: data.description };
        }
    } catch (error) {
        console.error(`❌ Ошибка: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ========== ПЛАНИРОВЩИК (ПРОВЕРКА КАЖДУЮ МИНУТУ) ==========
cron.schedule('* * * * *', async () => {
    const now = new Date();
    const nowString = now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' });
    console.log(`🔍 [${nowString}] Проверка напоминаний... Всего в очереди: ${reminders.length}`);
    
    const toSend = reminders.filter(r => !r.sent && new Date(r.scheduledTime) <= now);
    
    for (const reminder of toSend) {
        const message = `⏰ <b>НАПОМИНАНИЕ</b>\n━━━━━━━━━━━━━━━━━━\n📝 ${reminder.text}\n📅 ${reminder.date}\n⏰ ${reminder.time}\n━━━━━━━━━━━━━━━━━━\n✨ Не забудь выполнить!`;
        
        const result = await sendToTelegram(message);
        
        if (result.success) {
            reminder.sent = true;
            console.log(`✅ Отправлено: "${reminder.text}"`);
        }
    }
    
    // Очищаем старые напоминания (старше 1 часа)
    const oneHourAgo = new Date(Date.now() - 3600000);
    reminders = reminders.filter(r => !r.sent || new Date(r.scheduledTime) > oneHourAgo);
});

// ========== ЭНДПОИНТЫ ==========

app.get('/', (req, res) => {
    const now = new Date();
    res.json({
        status: 'online',
        server_time: now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }),
        timezone: 'Europe/Warsaw (Polska)',
        reminders_count: reminders.filter(r => !r.sent).length,
        bot: '@Kornel99_bot'
    });
});

app.get('/test', async (req, res) => {
    const now = new Date();
    const message = `🚀 <b>NEO LIFE ТЕСТ!</b>\n━━━━━━━━━━━━━━━━━━\n✅ Сервер работает!\n🕐 ${now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}\n🤖 Бот: @Kornel99_bot\n━━━━━━━━━━━━━━━━━━`;
    const result = await sendToTelegram(message);
    res.json({ success: result.success, server_time: now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }) });
});

app.post('/add-reminder', (req, res) => {
    const { userId, text, date, time } = req.body;
    const now = new Date();
    
    console.log(`📝 [${now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}] Получено: "${text}" na ${date} ${time}`);
    
    if (!text || !date || !time) {
        return res.status(400).json({ success: false, error: 'Brak wymaganych pól' });
    }
    
    // Создаём дату с учётом польского часового пояса
    const scheduledTime = new Date(`${date}T${time}:00`);
    
    if (isNaN(scheduledTime.getTime())) {
        return res.status(400).json({ success: false, error: 'Nieprawidłowa data lub godzina' });
    }
    
    // Если время уже прошло - отправляем сразу
    if (scheduledTime <= now) {
        const message = `⏰ <b>PRZYPOMNIENIE (natychmiast)</b>\n━━━━━━━━━━━━━━━━━━\n📝 ${text}\n📅 ${date}\n⏰ ${time}\n━━━━━━━━━━━━━━━━━━\n⚠️ Czas już minął, wysyłam teraz!`;
        sendToTelegram(message);
        return res.json({ success: true, message: 'Wysłano natychmiast' });
    }
    
    // Сохраняем напоминание
    reminders.push({
        id: reminderId++,
        userId,
        text,
        date,
        time,
        scheduledTime: scheduledTime.toISOString(),
        sent: false,
        createdAt: now.toISOString()
    });
    
    console.log(`✅ Zapisano. Wyślemy o: ${scheduledTime.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`);
    
    res.json({ 
        success: true, 
        message: 'Przypomnienie zaplanowane',
        will_be_sent_at: scheduledTime.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })
    });
});

app.get('/reminders', (req, res) => {
    const active = reminders.filter(r => !r.sent);
    res.json({ success: true, count: active.length, reminders: active });
});

app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' }),
        timezone: 'Europe/Warsaw'
    });
});

// ========== ЗАПУСК ==========
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
    const now = new Date();
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 Serwer NEO LIFE uruchomiony!`);
    console.log(`${'='.repeat(50)}`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`🕐 Czas serwera: ${now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}`);
    console.log(`🌍 Strefa czasowa: Europe/Warsaw (Polska)`);
    console.log(`🤖 Bot: @Kornel99_bot`);
    console.log(`${'='.repeat(50)}\n`);
});

// Приветственное сообщение
setTimeout(async () => {
    const now = new Date();
    await sendToTelegram(`🚀 <b>NEO LIFE Serwer uruchomiony!</b>\n━━━━━━━━━━━━━━━━━━\n✅ Status: Online\n🕐 ${now.toLocaleString('pl-PL', { timeZone: 'Europe/Warsaw' })}\n🌍 Strefa: Polska\n🤖 Bot: @Kornel99_bot\n━━━━━━━━━━━━━━━━━━`);
}, 3000);