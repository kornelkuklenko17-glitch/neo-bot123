const express = require('express');
const app = express();

// Middleware для парсинга JSON
app.use(express.json());

// ========== КОНФИГУРАЦИЯ ==========
// Токен твоего бота (добавляется в Environment Variables на Render)
const BOT_TOKEN = process.env.BOT_TOKEN;
// Твой Telegram ID (не меняй, если это твой ID)
const YOUR_TELEGRAM_ID = '8467166855';

// Хранилище напоминаний (в памяти)
let reminders = [];

// ========== ЭНДПОИНТЫ ==========

// Главная страница - проверка что сервер работает
app.get('/', (req, res) => {
    res.send('🤖 Telegram Reminder Bot работает! Напоминания будут приходить в Telegram от @Kornel99_bot');
});

// Эндпоинт для UptimeRobot (чтобы сервер не спал)
app.get('/keep-alive', (req, res) => {
    console.log(`🔋 Keep-alive ping в ${new Date().toLocaleTimeString()}`);
    res.status(200).send('alive');
});

// Добавление нового напоминания (из твоего HTML-трекера)
app.post('/add-reminder', (req, res) => {
    const { text, date, time } = req.body;
    
    // Проверка обязательных полей
    if (!text || !date || !time) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: text, date, time' 
        });
    }
    
    // Парсим дату и время
    const [year, month, day] = date.split('-');
    const [hours, minutes] = time.split(':');
    const timestamp = new Date(year, month - 1, day, hours, minutes, 0).getTime();
    
    // Сохраняем напоминание
    const reminder = {
        id: Date.now(),
        text: text,
        date: date,
        time: time,
        timestamp: timestamp,
        sent: false
    };
    
    reminders.push(reminder);
    
    console.log(`⏰ [${new Date().toLocaleTimeString()}] Напоминание добавлено: "${text}" на ${date} ${time}`);
    console.log(`📊 Всего напоминаний в очереди: ${reminders.length}`);
    
    res.json({ 
        success: true, 
        message: 'Напоминание сохранено',
        reminderId: reminder.id
    });
});

// Старый эндпоинт для совместимости с HTML-трекером
app.post('/add-task', (req, res) => {
    console.log(`📝 [${new Date().toLocaleTimeString()}] Задача получена:`, req.body);
    res.json({ success: true });
});

// Получить список всех активных напоминаний (для отладки)
app.get('/reminders', (req, res) => {
    const activeReminders = reminders.filter(r => !r.sent);
    res.json({ 
        total: reminders.length,
        active: activeReminders.length,
        reminders: activeReminders
    });
});

// ========== ОТПРАВКА В TELEGRAM ==========
async function sendToTelegram(message) {
    // Проверяем наличие токена
    if (!BOT_TOKEN) {
        console.log('❌ ОШИБКА: BOT_TOKEN не настроен!');
        console.log('💡 Добавь переменную окружения BOT_TOKEN в настройках Render');
        return false;
    }
    
    try {
        const https = require('https');
        
        // Формируем данные для отправки
        const data = JSON.stringify({
            chat_id: YOUR_TELEGRAM_ID,
            text: message,
            parse_mode: 'HTML'
        });
        
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
        const urlObj = new URL(url);
        
        return new Promise((resolve) => {
            const request = https.request({
                hostname: urlObj.hostname,
                path: urlObj.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            });
            
            request.on('error', (error) => {
                console.log(`❌ Ошибка отправки в Telegram: ${error.message}`);
                resolve(false);
            });
            
            request.on('response', (response) => {
                let body = '';
                response.on('data', (chunk) => body += chunk);
                response.on('end', () => {
                    try {
                        const result = JSON.parse(body);
                        if (result.ok) {
                            console.log(`✅ [${new Date().toLocaleTimeString()}] Отправлено в Telegram`);
                            resolve(true);
                        } else {
                            console.log(`❌ Ошибка Telegram API: ${result.description}`);
                            resolve(false);
                        }
                    } catch (error) {
                        console.log(`❌ Ошибка парсинга ответа: ${error.message}`);
                        resolve(false);
                    }
                });
            });
            
            request.write(data);
            request.end();
        });
        
    } catch (error) {
        console.log(`❌ Критическая ошибка отправки: ${error.message}`);
        return false;
    }
}

// ========== ПРОВЕРКА НАПОМИНАНИЙ ==========
// Запускаем каждую минуту
setInterval(async () => {
    const now = Date.now();
    const remindersToSend = reminders.filter(r => r.timestamp <= now && !r.sent);
    
    if (remindersToSend.length > 0) {
        console.log(`🕐 [${new Date().toLocaleTimeString()}] Найдено ${remindersToSend.length} напоминаний для отправки`);
    }
    
    for (const reminder of remindersToSend) {
        const message = `🔔 <b>НАПОМИНАНИЕ!</b>\n\n📅 ${reminder.date}\n⏰ ${reminder.time}\n📝 ${reminder.text}`;
        
        const sent = await sendToTelegram(message);
        
        if (sent) {
            reminder.sent = true;
            console.log(`📢 [${new Date().toLocaleTimeString()}] Отправлено: "${reminder.text}"`);
        } else {
            console.log(`⚠️ [${new Date().toLocaleTimeString()}] Не удалось отправить: "${reminder.text}"`);
        }
    }
}, 60000); // Каждую минуту

// Очистка старых отправленных напоминаний (раз в час)
setInterval(() => {
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const beforeCount = reminders.length;
    reminders = reminders.filter(r => !r.sent || r.timestamp >= oneDayAgo);
    const clearedCount = beforeCount - reminders.length;
    
    if (clearedCount > 0) {
        console.log(`🧹 [${new Date().toLocaleTimeString()}] Очищено ${clearedCount} старых напоминаний`);
    }
}, 60 * 60 * 1000); // Каждый час

// ========== ЗАПУСК СЕРВЕРА ==========
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║     🤖 TELEGRAM REMINDER BOT - ЗАПУЩЕН                    ║');
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  🚀 Сервер: http://localhost:${port}                      ║`);
    console.log(`║  📡 Keep-alive: http://localhost:${port}/keep-alive       ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    console.log(`║  🤖 Бот: @Kornel99_bot                                   ║`);
    console.log(`║  👤 Telegram ID: ${YOUR_TELEGRAM_ID}                      ║`);
    console.log('╠══════════════════════════════════════════════════════════╣');
    
    if (BOT_TOKEN) {
        console.log(`║  ✅ Токен настроен: ${BOT_TOKEN.substring(0, 10)}...    ║`);
        console.log(`║  📱 Напоминания будут приходить в Telegram             ║`);
    } else {
        console.log('║  ⚠️  ВНИМАНИЕ: BOT_TOKEN не настроен!                  ║');
        console.log('║  💡 Добавь переменную окружения BOT_TOKEN              ║');
    }
    
    console.log('╚══════════════════════════════════════════════════════════╝');
});