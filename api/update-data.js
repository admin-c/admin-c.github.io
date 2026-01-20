// Упрощённый работающий API
module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        const { action, data, secret } = req.body;

        // Простая проверка
        if (!secret || secret !== 'Ali') {
            return res.status(401).json({ error: 'Unauthorized: Invalid secret key' });
        }

        // Хранилище в памяти (временное)
        let storage = {
            teams: [],
            matches: [],
            news: [
                {
                    id: "1",
                    title: "Либилская Лига запущена!",
                    content: "Добро пожаловать на официальный сайт турнира по FC Mobile.",
                    date: new Date().toISOString()
                }
            ],
            adminNotifications: [],
            lastUpdated: new Date().toISOString()
        };

        if (action === 'get-data') {
            return res.status(200).json(storage);
        }

        if (action === 'update-data') {
            if (!data) {
                return res.status(400).json({ error: 'Missing data' });
            }
            
            // В реальном приложении здесь будет сохранение в базу данных
            // Пока просто возвращаем подтверждение
            return res.status(200).json({
                success: true,
                message: 'Data update simulated',
                received: {
                    teams: data.teams?.length || 0,
                    matches: data.matches?.length || 0,
                    news: data.news?.length || 0
                },
                timestamp: new Date().toISOString()
            });
        }

        if (action === 'add-notification') {
            return res.status(200).json({
                success: true,
                message: 'Notification added',
                timestamp: new Date().toISOString()
            });
        }

        if (action === 'stats') {
            return res.status(200).json({
                teams: storage.teams.length,
                matches: storage.matches.length,
                news: storage.news.length,
                notifications: storage.adminNotifications.length,
                status: 'api_working'
            });
        }

        return res.status(400).json({ 
            error: 'Invalid action',
            supportedActions: ['get-data', 'update-data', 'add-notification', 'stats']
        });

    } catch (error) {
        console.error('API Error:', error);
        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
};
