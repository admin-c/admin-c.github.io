const { Octokit } = require('@octokit/rest');

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

        // 1. Проверка секрета админки из переменной окружения
        const ADMIN_SECRET = process.env.ADMIN_SECRET;
        if (secret !== ADMIN_SECRET) {
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'Invalid admin secret'
            });
        }

        // 2. Получаем GitHub данные из переменных окружения Vercel
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_REPO = process.env.GITHUB_REPO || 'admin-c/admin-c.github.io';

        if (!GITHUB_TOKEN) {
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'GITHUB_TOKEN environment variable is not set in Vercel'
            });
        }

        const [owner, repo] = GITHUB_REPO.split('/');
        if (!owner || !repo) {
            return res.status(500).json({ 
                error: 'Invalid repository configuration',
                message: 'GITHUB_REPO should be in format: owner/repo-name'
            });
        }

        // 3. Инициализация Octokit с токеном из переменных окружения
        const octokit = new Octokit({
            auth: GITHUB_TOKEN,
            userAgent: 'FC-Mobile-League/1.0.0',
            timeZone: 'Europe/Moscow'
        });

        // 4. Обработка действий
        if (action === 'get-data') {
            try {
                // Получаем текущий файл data.json из репозитория
                const { data: fileData } = await octokit.repos.getContent({
                    owner,
                    repo,
                    path: 'data.json',
                    ref: 'main'
                });

                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                const jsonData = JSON.parse(content);

                return res.status(200).json({
                    ...jsonData,
                    _meta: {
                        sha: fileData.sha,
                        lastFetched: new Date().toISOString(),
                        repo: GITHUB_REPO
                    }
                });

            } catch (githubError) {
                // Если файл не найден (404), создаём начальную структуру
                if (githubError.status === 404) {
                    const initialData = {
                        teams: [],
                        matches: [],
                        news: [
                            {
                                id: "welcome",
                                title: "Либилская Лига запущена!",
                                content: "Добро пожаловать на официальный сайт турнира по FC Mobile.",
                                date: new Date().toISOString()
                            }
                        ],
                        adminNotifications: [],
                        settings: {
                            prizePool: 500,
                            startDate: "2026-01-24",
                            matchDays: ["Суббота", "Воскресенье"],
                            version: "1.0.0"
                        },
                        lastUpdated: new Date().toISOString()
                    };

                    // Создаём файл в репозитории
                    await octokit.repos.createOrUpdateFileContents({
                        owner,
                        repo,
                        path: 'data.json',
                        message: 'Initial data file for FC Mobile League',
                        content: Buffer.from(JSON.stringify(initialData, null, 2)).toString('base64'),
                        committer: {
                            name: 'League Admin',
                            email: 'admin@league.com'
                        }
                    });

                    return res.status(200).json({
                        ...initialData,
                        _meta: {
                            created: true,
                            lastFetched: new Date().toISOString(),
                            repo: GITHUB_REPO
                        }
                    });
                }

                // Другие ошибки GitHub
                throw githubError;
            }
        }

        if (action === 'update-data') {
            if (!data) {
                return res.status(400).json({ error: 'No data provided' });
            }

            // Получаем текущий SHA файла
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
                // Если файла нет, SHA будет null
                if (error.status !== 404) throw error;
            }

            // Обновляем файл в репозитории
            const { data: updateResult } = await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'data.json',
                message: `Update league data: ${new Date().toLocaleDateString('ru-RU')}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                sha: currentSha,
                branch: 'main',
                committer: {
                    name: 'League Admin',
                    email: 'admin@league.com'
                }
            });

            return res.status(200).json({
                success: true,
                message: 'Data successfully saved to GitHub',
                commit: {
                    sha: updateResult.commit.sha.substring(0, 8),
                    url: updateResult.commit.html_url,
                    message: updateResult.commit.message
                },
                timestamp: new Date().toISOString()
            });
        }

        if (action === 'add-notification') {
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
                message: data.message || 'New notification',
                type: data.type || 'info',
                date: new Date().toISOString(),
                read: false
            };

            jsonData.adminNotifications.unshift(notification);

            // Сохраняем обновлённые данные
            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'data.json',
                message: `Admin notification: ${notification.message.substring(0, 50)}...`,
                content: Buffer.from(JSON.stringify(jsonData, null, 2)).toString('base64'),
                sha: fileData.sha
            });

            return res.status(200).json({
                success: true,
                notification,
                message: 'Notification added'
            });
        }

        if (action === 'health') {
            // Проверка работоспособности
            try {
                // Проверяем доступ к репозиторию
                await octokit.repos.get({
                    owner,
                    repo
                });

                return res.status(200).json({
                    status: 'healthy',
                    github: {
                        connected: true,
                        repo: GITHUB_REPO,
                        permissions: 'read/write'
                    },
                    admin: {
                        secret_configured: !!ADMIN_SECRET
                    },
                    timestamp: new Date().toISOString()
                });

            } catch (healthError) {
                return res.status(500).json({
                    status: 'unhealthy',
                    error: healthError.message,
                    github: {
                        connected: false,
                        repo: GITHUB_REPO
                    },
                    timestamp: new Date().toISOString()
                });
            }
        }

        // Неизвестное действие
        return res.status(400).json({ 
            error: 'Invalid action',
            supportedActions: ['get-data', 'update-data', 'add-notification', 'health']
        });

    } catch (error) {
        console.error('API Error:', {
            message: error.message,
            status: error.status,
            request: error.request,
            response: error.response?.data
        });

        // Обработка специфических ошибок GitHub
        let errorMessage = 'Internal Server Error';
        let statusCode = 500;

        if (error.status === 401) {
            errorMessage = 'GitHub Authentication Failed: Invalid or expired token';
            statusCode = 401;
        } else if (error.status === 403) {
            errorMessage = 'GitHub API Rate Limit Exceeded';
            statusCode = 429;
        } else if (error.status === 404) {
            errorMessage = `Repository not found: ${process.env.GITHUB_REPO}`;
            statusCode = 404;
        }

        return res.status(statusCode).json({
            error: errorMessage,
            details: process.env.NODE_ENV === 'development' ? error.message : undefined,
            timestamp: new Date().toISOString()
        });
    }
};
