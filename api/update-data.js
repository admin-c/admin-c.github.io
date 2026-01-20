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
        // Парсим тело запроса
        let body = {};
        try {
            if (req.body) {
                body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
            }
        } catch (parseError) {
            return res.status(400).json({ 
                error: 'Invalid JSON in request body',
                message: parseError.message 
            });
        }

        const { action, data, secret } = body;

        console.log('API Request:', { action, secret: secret ? '***' : 'missing', hasData: !!data });

        // Проверка секрета админки
        const ADMIN_SECRET = process.env.ADMIN_SECRET;
        if (!ADMIN_SECRET) {
            return res.status(500).json({ 
                error: 'Server configuration error',
                message: 'ADMIN_SECRET environment variable is not set'
            });
        }

        if (secret !== ADMIN_SECRET) {
            return res.status(401).json({ 
                error: 'Unauthorized',
                message: 'Invalid admin secret key'
            });
        }

        // Проверка GitHub переменных
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const GITHUB_REPO = process.env.GITHUB_REPO || 'admin-c/admin-c.github.io';

        if (!GITHUB_TOKEN) {
            return res.status(500).json({ 
                error: 'GitHub configuration error',
                message: 'GITHUB_TOKEN environment variable is not set in Vercel',
                help: 'Add GITHUB_TOKEN to Environment Variables in Vercel Dashboard'
            });
        }

        const [owner, repo] = GITHUB_REPO.split('/');
        if (!owner || !repo) {
            return res.status(500).json({ 
                error: 'Invalid repository configuration',
                message: `GITHUB_REPO should be in format: owner/repo-name. Got: ${GITHUB_REPO}`
            });
        }

        // Инициализация Octokit
        const octokit = new Octokit({
            auth: GITHUB_TOKEN,
            userAgent: 'FC-Mobile-League/1.0.0',
            timeZone: 'Europe/Moscow',
            log: console
        });

        // Проверка подключения к GitHub
        try {
            await octokit.repos.get({ owner, repo });
            console.log('GitHub connection successful to:', `${owner}/${repo}`);
        } catch (githubError) {
            console.error('GitHub connection failed:', githubError.message);
            return res.status(500).json({
                error: 'GitHub connection failed',
                message: githubError.message,
                details: `Repository: ${owner}/${repo}`,
                status: githubError.status
            });
        }

        // Обработка действий
        if (action === 'get-data') {
            try {
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
                        repo: GITHUB_REPO,
                        size: content.length
                    }
                });

            } catch (githubError) {
                if (githubError.status === 404) {
                    // Создаём начальный файл
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
                        message: 'Initial data file for FC Mobile League',
                        content: Buffer.from(JSON.stringify(initialData, null, 2)).toString('base64')
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
                throw githubError;
            }
        }

        if (action === 'update-data') {
            if (!data) {
                return res.status(400).json({ error: 'No data provided for update' });
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

            // Обновляем данные
            const { data: updateResult } = await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'data.json',
                message: `Update league data: ${new Date().toLocaleDateString('ru-RU')}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                sha: currentSha,
                branch: 'main'
            });

            return res.status(200).json({
                success: true,
                message: 'Data successfully saved to GitHub',
                commit: {
                    sha: updateResult.commit.sha.substring(0, 8),
                    url: updateResult.commit.html_url,
                    message: updateResult.commit.message
                },
                timestamp: new Date().toISOString(),
                stats: {
                    teams: data.teams?.length || 0,
                    matches: data.matches?.length || 0,
                    news: data.news?.length || 0
                }
            });
        }

        if (action === 'add-notification') {
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: 'data.json',
                ref: 'main'
            });

            const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
            const jsonData = JSON.parse(content);

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

        if (action === 'health') {
            const repoInfo = await octokit.repos.get({ owner, repo });
            const rateLimit = await octokit.rateLimit.get();
            
            return res.status(200).json({
                status: 'healthy',
                api: 'working',
                github: {
                    connected: true,
                    repo: `${owner}/${repo}`,
                    visibility: repoInfo.data.visibility,
                    permissions: 'read/write'
                },
                environment: {
                    ADMIN_SECRET: ADMIN_SECRET ? 'configured' : 'missing',
                    GITHUB_TOKEN: GITHUB_TOKEN ? 'configured' : 'missing',
                    GITHUB_REPO: GITHUB_REPO
                },
                rateLimit: {
                    remaining: rateLimit.data.rate.remaining,
                    limit: rateLimit.data.rate.limit,
                    reset: new Date(rateLimit.data.rate.reset * 1000).toISOString()
                },
                timestamp: new Date().toISOString()
            });
        }

        return res.status(400).json({ 
            error: 'Invalid action',
            supportedActions: ['get-data', 'update-data', 'add-notification', 'health'],
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('API Error Details:', {
            message: error.message,
            status: error.status,
            request: error.request,
            response: error.response?.data,
            stack: error.stack
        });

        const errorResponse = {
            error: 'Internal Server Error',
            message: error.message,
            timestamp: new Date().toISOString()
        };

        if (error.status === 401) {
            errorResponse.error = 'GitHub Authentication Failed';
            errorResponse.message = 'Invalid or expired GITHUB_TOKEN';
        } else if (error.status === 403) {
            errorResponse.error = 'GitHub API Rate Limit';
            errorResponse.message = 'Too many requests to GitHub API';
        } else if (error.status === 404) {
            errorResponse.error = 'Repository Not Found';
            errorResponse.message = `Check GITHUB_REPO: ${process.env.GITHUB_REPO}`;
        }

        return res.status(error.status || 500).json(errorResponse);
    }
};
