const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    // Настройка CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    // Обработка preflight запросов
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { action, data, secret } = req.body;

    // Проверка секретного ключа
    const ADMIN_SECRET = process.env.ADMIN_SECRET || 'Ali';
    if (secret !== ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }

    // Проверка обязательных переменных окружения
    if (!process.env.GITHUB_TOKEN) {
        return res.status(500).json({ error: 'Server misconfiguration: GITHUB_TOKEN not set' });
    }

    if (!process.env.GITHUB_REPO) {
        return res.status(500).json({ error: 'Server misconfiguration: GITHUB_REPO not set' });
    }

    // Парсим репозиторий из переменной окружения
    const [owner, repo] = process.env.GITHUB_REPO.split('/');
    if (!owner || !repo) {
        return res.status(500).json({ error: 'Invalid GITHUB_REPO format. Use: owner/repo-name' });
    }

    // Инициализация GitHub API
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    });

    try {
        if (action === 'get-data') {
            // Получение текущих данных из GitHub
            try {
                const { data: fileData } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: 'data.json',
                    ref: 'main'
                });

                // Декодируем содержимое
                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                const jsonData = JSON.parse(content);
                
                return res.status(200).json({
                    ...jsonData,
                    _meta: {
                        lastFetched: new Date().toISOString(),
                        sha: fileData.sha,
                        source: 'github'
                    }
                });

            } catch (githubError) {
                // Если файл не существует, создаём начальную структуру
                if (githubError.status === 404) {
                    const initialData = {
                        teams: [],
                        matches: [],
                        news: [
                            {
                                id: "welcome",
                                title: "Добро пожаловать в Либилскую Лигу!",
                                content: "Регистрация на первый сезон открыта. Турнир стартует 24 января 2026 года.",
                                date: new Date().toISOString()
                            }
                        ],
                        adminNotifications: [],
                        settings: {
                            prizePool: 500,
                            startDate: "2026-01-24",
                            matchDays: ["Суббота", "Воскресенье"]
                        }
                    };

                    // Пытаемся создать файл
                    try {
                        await octokit.repos.createOrUpdateFileContents({
                            owner,
                            repo,
                            path: 'data.json',
                            message: 'Initial data.json creation',
                            content: Buffer.from(JSON.stringify(initialData, null, 2)).toString('base64')
                        });

                        return res.status(200).json({
                            ...initialData,
                            _meta: {
                                lastFetched: new Date().toISOString(),
                                source: 'created_initial'
                            }
                        });

                    } catch (createError) {
                        console.error('Error creating initial file:', createError);
                        return res.status(500).json({ 
                            error: 'Failed to create initial data file',
                            details: createError.message
                        });
                    }
                }

                // Другие ошибки GitHub
                throw githubError;
            }
        }

        if (action === 'update-data') {
            if (!data) {
                return res.status(400).json({ error: 'Missing data parameter' });
            }

            // Получаем текущий файл для получения SHA
            let currentSha = null;
            try {
                const { data: fileData } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: 'data.json',
                    ref: 'main'
                });
                currentSha = fileData.sha;
            } catch (error) {
                // Если файла нет, SHA будет null (создадим новый)
                if (error.status !== 404) throw error;
            }

            // Обновляем файл на GitHub
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'data.json',
                message: `Update league data: ${new Date().toISOString()}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                sha: currentSha,
                branch: 'main'
            });

            // Триггер пересборки Vercel (если настроен вебхук)
            if (process.env.VERCEL_DEPLOY_HOOK) {
                try {
                    await fetch(process.env.VERCEL_DEPLOY_HOOK, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });
                } catch (webhookError) {
                    console.warn('Vercel webhook failed:', webhookError);
                    // Не прерываем выполнение, если вебхук не сработал
                }
            }

            // Триггер пересборки GitHub Pages
            try {
                await octokit.repos.createPagesSite({
                    owner,
                    repo,
                    source: {
                        branch: 'main',
                        path: '/'
                    }
                });
            } catch (pagesError) {
                // GitHub Pages уже настроен или ошибка настройки
                console.log('GitHub Pages note:', pagesError.message);
            }

            return res.status(200).json({
                success: true,
                message: 'Data successfully updated on GitHub',
                timestamp: new Date().toISOString(),
                trigger: {
                    vercel: !!process.env.VERCEL_DEPLOY_HOOK,
                    githubPages: true
                }
            });
        }

        if (action === 'add-notification') {
            // Добавление уведомления в админ-панель
            const { message, type = 'info' } = data;
            
            if (!message) {
                return res.status(400).json({ error: 'Missing notification message' });
            }

            // Получаем текущие данные
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: 'data.json',
                ref: 'main'
            });

            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const jsonData = JSON.parse(content);

            // Добавляем уведомление
            if (!jsonData.adminNotifications) {
                jsonData.adminNotifications = [];
            }

            const notification = {
                id: Date.now().toString(),
                message,
                type,
                date: new Date().toISOString(),
                read: false
            };

            jsonData.adminNotifications.unshift(notification);

            // Сохраняем обновлённые данные
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'data.json',
                message: `Add admin notification: ${message.substring(0, 50)}...`,
                content: Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64'),
                sha: fileData.sha
            });

            return res.status(200).json({
                success: true,
                notification,
                message: 'Notification added successfully'
            });
        }

        // Статистика
        if (action === 'stats') {
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: 'data.json',
                ref: 'main'
            });

            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const jsonData = JSON.parse(content);

            const stats = {
                teams: jsonData.teams?.length || 0,
                matches: jsonData.matches?.length || 0,
                news: jsonData.news?.length || 0,
                notifications: jsonData.adminNotifications?.length || 0,
                unreadNotifications: jsonData.adminNotifications?.filter(n => !n.read).length || 0,
                lastUpdated: fileData.sha ? new Date().toISOString() : null
            };

            return res.status(200).json(stats);
        }

        return res.status(400).json({ 
            error: 'Invalid action',
            supportedActions: ['get-data', 'update-data', 'add-notification', 'stats']
        });

    } catch (error) {
        console.error('API Error details:', {
            message: error.message,
            status: error.status,
            headers: error.headers,
            request: error.request,
            response: error.response?.data
        });

        // Детализированные ошибки
        if (error.status === 401) {
            return res.status(401).json({ 
                error: 'GitHub Authentication Failed',
                message: 'Invalid or expired GITHUB_TOKEN'
            });
        }

        if (error.status === 403) {
            return res.status(403).json({ 
                error: 'GitHub API Rate Limit Exceeded',
                message: 'Too many requests to GitHub API'
            });
        }

        if (error.status === 404) {
            return res.status(404).json({ 
                error: 'Repository or file not found',
                message: `Check GITHUB_REPO configuration: ${process.env.GITHUB_REPO}`
            });
        }

        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
            timestamp: new Date().toISOString()
        });
    }
};
