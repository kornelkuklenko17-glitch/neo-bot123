const express = require('express');
const app = express();
app.use(express.json());

// ВАШИ ДАННЫЕ (проверьте!)
const TOKEN = '8213575021:AAEU5WPKy9yMLJmly2jn1QI_zwlBmAq_pEQ';
const CHAT_ID = '8467166855';  // Убедитесь что это правильный ID!

// Простая функция отправки
async function sendMessage(text) {
    try {
        const url = `https://api.telegram.org/bot${TOKEN}/sendMessage`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                text: text
            })
        });
        const result = await response.json();
        console.log('Telegram ответ:', result);
        return result.ok;
    } catch (err) {
        console.error('Ошибка:', err.message);
        return false;
    }
}

// Эндпоинт для проверки
app.get('/', (req, res) => {
    res.send('Бот работает! Перейдите на /test');
});

// Эндпоинт для теста
app.get('/test', async (req, res) => {
    const result = await sendMessage('✅ Тест! Бот работает!');
    if (result) {
        res.send('Сообщение отправлено! Проверьте Telegram');
    } else {
        res.send('Ошибка отправки. Смотрите логи.');
    }
});

// Ваш эндпоинт для напоминаний
app.post('/reminder', async (req, res) => {
    const { text, time } = req.body;
    const message = `⏰ Напоминание: ${text}\nВремя: ${time || 'сейчас'}`;
    
    const result = await sendMessage(message);
    
    if (result) {
        res.json({ success: true });
    } else {
        res.status(500).json({ success: false });
    }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
    console.log(`Токен: ${TOKEN ? 'Установлен' : 'Нет'}`);
    console.log(`Chat ID: ${CHAT_ID || 'Нет'}`);
});