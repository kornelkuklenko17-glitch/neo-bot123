const express = require('express');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// ========== КОНФИГУРАЦИЯ ==========
const TELEGRAM_TOKEN = '8213575021:AAEU5WPKy9yMLJmly2jn1QI_zwlBmAq_pEQ';
const TELEGRAM_CHAT_ID = '8467166855';

// Хранилище напоминаний (в реальном проекте лучше использовать БД)
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
            console.log(`✅ [${new Date().toISOString()}] Сообщение отправлено в Telegram`);
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
    console.log(`🔍 [${now.toISOString()}] Проверка напоминаний... Всего в очереди: ${reminders.length}`);
    
    // Находим напоминания для отправки
    const toSend = reminders.filter(r => !r.sent && new Date(r.scheduledTime) <= now);
    
    for (const reminder of toSend) {
        const message = `⏰ <b>НАПОМИНАНИЕ</b>\n━━━━━━━━━━━━━━━━━━\n📝 ${reminder.text}\n📅 ${reminder.date}\n⏰ ${reminder.time}\n━━━━━━━━━━━━━━━━━━\n✨ Не забудь выполнить!`;
        
        const result = await sendToTelegram(message);
        
        if (result.success) {
            reminder.sent = true;
            console.log(`✅ Отправлено: "${reminder.text}" на ${reminder.date} ${reminder.time}`);
        } else {
            console.log(`❌ Ошибка отправки: "${reminder.text}"`);
        }
    }
    
    // Очищаем отправленные напоминания (старше 1 часа)
    const oneHourAgo = new Date(Date.now() - 3600000);
    const beforeClean = reminders.length;
    reminders = reminders.filter(r => !r.sent || new Date(r.scheduledTime) > oneHourAgo);
    
    if (beforeClean !== reminders.length) {
        console.log(`🧹 Очищено ${beforeClean - reminders.length} старых напоминаний`);
    }
});

// ========== ЭНДПОИНТЫ API ==========

// Главная страница (проверка работы)
app.get('/', (req, res) => {
    res.json({
        status: 'online',
        time: new Date().toISOString(),
        reminders_count: reminders.filter(r => !r.sent).length,
        bot: '@Kornel99_bot',
        uptime: process.uptime(),
        endpoints: ['GET /', 'GET /test', 'POST /add-reminder', 'GET /reminders', 'DELETE /reminder/:id']
    });
});

// Тестовый эндпоинт
app.get('/test', async (req, res) => {
    const message = `🚀 <b>NEO LIFE ТЕСТ!</b>\n━━━━━━━━━━━━━━━━━━\n✅ Сервер работает!\n🕐 ${new Date().toLocaleString('ru-RU')}\n🤖 Бот: @Kornel99_bot\n📅 Напоминаний в очереди: ${reminders.filter(r => !r.sent).length}\n━━━━━━━━━━━━━━━━━━`;
    const result = await sendToTelegram(message);
    res.json({ 
        success: result.success, 
        message: result.success ? 'Test message sent to Telegram' : result.error,
        reminders_waiting: reminders.filter(r => !r.sent).length
    });
});

// Добавление напоминания (основной эндпоинт)
app.post('/add-reminder', (req, res) => {
    const { userId, text, date, time } = req.body;
    
    console.log(`📝 [${new Date().toISOString()}] Получено напоминание: userId=${userId}, text="${text}", date=${date}, time=${time}`);
    
    // Валидация
    if (!text || !date || !time) {
        console.log(`❌ Ошибка: отсутствуют обязательные поля`);
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: text, date, time' 
        });
    }
    
    // Проверяем валидность даты
    const scheduledTime = new Date(`${date}T${time}:00`);
    if (isNaN(scheduledTime.getTime())) {
        return res.status(400).json({
            success: false,
            error: 'Invalid date or time format'
        });
    }
    
    const now = new Date();
    
    // Если время уже прошло - отправляем сразу
    if (scheduledTime <= now) {
        const message = `⏰ <b>НАПОМИНАНИЕ (срочно)</b>\n━━━━━━━━━━━━━━━━━━\n📝 ${text}\n📅 ${date}\n⏰ ${time}\n━━━━━━━━━━━━━━━━━━\n⚠️ Время уже прошло, отправляю сейчас!`;
        sendToTelegram(message);
        return res.json({ 
            success: true, 
            message: 'Reminder sent immediately (time already passed)',
            reminder: { text, date, time, status: 'sent_now' }
        });
    }
    
    // Сохраняем напоминание
    const reminder = {
        id: reminderId++,
        userId,
        text,
        date,
        time,
        scheduledTime: scheduledTime.toISOString(),
        sent: false,
        createdAt: now.toISOString()
    };
    
    reminders.push(reminder);
    
    console.log(`✅ Напоминание сохранено. ID: ${reminder.id}, Отправим в: ${scheduledTime.toISOString()}`);
    
    res.json({ 
        success: true, 
        message: 'Reminder scheduled successfully',
        reminder: {
            id: reminder.id,
            text,
            date,
            time,
            will_be_sent_at: scheduledTime.toISOString()
        }
    });
});

// Получить список активных напоминаний
app.get('/reminders', (req, res) => {
    const active = reminders.filter(r => !r.sent);
    res.json({
        success: true,
        count: active.length,
        reminders: active.map(r => ({
            id: r.id,
            text: r.text,
            date: r.date,
            time: r.time,
            scheduledTime: r.scheduledTime
        }))
    });
});

// Удалить напоминание по ID
app.delete('/reminder/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const before = reminders.length;
    reminders = reminders.filter(r => r.id !== id);
    const deleted = before - reminders.length;
    
    console.log(`🗑️ Удалено напоминание ID: ${id}, удалено: ${deleted}`);
    
    res.json({ 
        success: true, 
        deleted: deleted,
        message: deleted ? 'Reminder deleted' : 'Reminder not found'
    });
});

// Статистика
app.get('/stats', (req, res) => {
    const active = reminders.filter(r => !r.sent).length;
    const sent = reminders.filter(r => r.sent).length;
    const total = reminders.length;
    
    res.json({
        success: true,
        stats: {
            total_reminders: total,
            active_reminders: active,
            sent_reminders: sent,
            uptime_seconds: process.uptime()
        }
    });
});

// Health check (для UptimeRobot)
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        reminders_active: reminders.filter(r => !r.sent).length
    });
});

// Обработка 404
app.use((req, res) => {
    res.status(404).json({ 
        success: false, 
        error: 'Endpoint not found',
        available_endpoints: [
            'GET /',
            'GET /test',
            'GET /health',
            'GET /stats',
            'GET /reminders',
            'POST /add-reminder',
            'DELETE /reminder/:id'
        ]
    });
});

// Обработка ошибок
app.use((err, req, res, next) => {
    console.error(`❌ Unhandled error: ${err.message}`);
    res.status(500).json({ 
        success: false, 
        error: 'Internal server error',
        message: err.message
    });
});

// ========== ЗАПУСК СЕРВЕРА ==========
const PORT = process.env.PORT || 10000;

const server = app.listen(PORT, () => {
    console.log(`\n${'='.repeat(50)}`);
    console.log(`🚀 NEO LIFE Telegram Bot запущен!`);
    console.log(`${'='.repeat(50)}`);
    console.log(`📡 Порт: ${PORT}`);
    console.log(`🤖 Бот: @Kornel99_bot`);
    console.log(`👤 Chat ID: ${TELEGRAM_CHAT_ID}`);
    console.log(`✅ Telegram: ${TELEGRAM_TOKEN ? 'Настроен' : 'НЕ НАСТРОЕН'}`);
    console.log(`📅 Планировщик: активен (проверка каждую минуту)`);
    console.log(`${'='.repeat(50)}\n`);
});

// Отправка сообщения о запуске
setTimeout(async () => {
    const message = `🚀 <b>NEO LIFE Сервер запущен!</b>\n━━━━━━━━━━━━━━━━━━\n✅ Статус: Online\n🕐 ${new Date().toLocaleString('ru-RU')}\n📅 Планировщик активен\n🤖 Бот готов к работе\n━━━━━━━━━━━━━━━━━━`;
    const result = await sendToTelegram(message);
    if (result.success) {
        console.log('✅ Приветственное сообщение отправлено в Telegram');
    } else {
        console.log(`⚠️ Не удалось отправить приветственное сообщение: ${result.error}`);
    }
}, 3000);

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 Получен SIGTERM, закрываю сервер...');
    server.close(() => {
        console.log('✅ Сервер закрыт');
        process.exit(0);
    });
});

process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
    sendToTelegram(`⚠️ <b>Ошибка на сервере</b>\n\`\`\`\n${error.message}\n\`\`\``);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
    sendToTelegram(`⚠️ <b>Unhandled Rejection</b>\n\`\`\`\n${reason}\n\`\`\``);
});