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

        // Проверка секретного ключа
        if (secret !== (process.env.ADMIN_SECRET || 'Ali')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        // Проверка переменных окружения
        if (!process.env.GITHUB_TOKEN || !process.env.GITHUB_REPO) {
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'GitHub credentials not configured'
            });
        }

        const [owner, repo] = process.env.GITHUB_REPO.split('/');
        if (!owner || !repo) {
            return res.status(500).json({ 
                error: 'Invalid repository format',
                message: 'GITHUB_REPO should be in format: owner/repo-name'
            });
        }

        // Инициализация Octokit
        const octokit = new Octokit({
            auth: process.env.GITHUB_TOKEN,
            userAgent: 'fc-mobile-league/1.0.0'
        });

        if (action === 'get-data') {
            try {
                // Получаем файл из GitHub
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
                        lastFetched: new Date().toISOString()
                    }
                });

            } catch (githubError) {
                // Если файла нет, создаём начальный
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

                    await octokit.repos.createOrUpdateFileContents({
                        owner,
                        repo,
                        path: 'data.json',
                        message: 'Initial data file creation',
                        content: Buffer.from(JSON.stringify(initialData, null, 2)).toString('base64')
                    });

                    return res.status(200).json({
                        ...initialData,
                        _meta: {
                            created: true,
                            lastFetched: new Date().toISOString()
                        }
                    });
                }

                throw githubError;
            }
        }

        if (action === 'update-data') {
            if (!data) {
                return res.status(400).json({ error: 'No data provided' });
            }

            // Получаем текущий SHA
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
                if (error.status !== 404) throw error;
            }

            // Обновляем файл
            const { data: updateResult } = await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'data.json',
                message: `League data update: ${new Date().toISOString().split('T')[0]}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                sha: currentSha,
                branch: 'main'
            });

            // Обновляем GitHub Pages
            try {
                await octokit.repos.requestPagesBuild({
                    owner,
                    repo
                });
            } catch (pagesError) {
                // Игнорируем ошибки Pages
                console.log('GitHub Pages build triggered');
            }

            return res.status(200).json({
                success: true,
                message: 'Data saved to GitHub successfully',
                commit: {
                    sha: updateResult.commit.sha,
                    url: updateResult.commit.html_url
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

            // Сохраняем обратно
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
                notification
            });
        }

        if (action === 'backup') {
            // Создание backup файла
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: 'data.json',
                ref: 'main'
            });

            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const backupData = JSON.parse(content);

            const backupName = `backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: `backups/${backupName}`,
                message: `Data backup: ${new Date().toISOString()}`,
                content: Buffer.from(JSON.stringify(backupData, null, 2)).toString('base64'),
                branch: 'main'
            });

            return res.status(200).json({
                success: true,
                backup: backupName,
                timestamp: new Date().toISOString()
            });
        }

        return res.status(400).json({ 
            error: 'Invalid action',
            supportedActions: ['get-data', 'update-data', 'add-notification', 'backup']
        });

    } catch (error) {
        console.error('API Error:', {
            message: error.message,
            status: error.status,
            request: error.request,
            response: error.response?.data
        });

        // Детальные ошибки
        if (error.status === 401) {
            return res.status(401).json({ 
                error: 'GitHub Authentication Failed',
                message: 'Check GITHUB_TOKEN in environment variables'
            });
        }

        if (error.status === 403) {
            return res.status(403).json({ 
                error: 'GitHub API Rate Limit',
                message: 'Too many requests to GitHub API'
            });
        }

        if (error.status === 404) {
            return res.status(404).json({ 
                error: 'Repository not found',
                message: `Check GITHUB_REPO: ${process.env.GITHUB_REPO}`
            });
        }

        return res.status(500).json({ 
            error: 'Internal Server Error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
};
