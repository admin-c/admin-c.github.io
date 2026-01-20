// Этот файл должен быть размещен в /api/update-data.js на Vercel

const { Octokit } = require('@octokit/rest');

module.exports = async (req, res) => {
    // ДОБАВЬТЕ ЭТИ ЗАГОЛОВКИ В САМОМ НАЧАЛЕ:
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
    if (secret !== process.env.ADMIN_SECRET || !process.env.ADMIN_SECRET) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    // Инициализация GitHub API
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    });

    const [owner, repo] = process.env.GITHUB_REPO.split('/');

    try {
        if (action === 'get-data') {
            // Получение текущих данных
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: 'data.json'
            });

            const content = Buffer.from(fileData.content, 'base64').toString();
            return res.status(200).json(JSON.parse(content));
        }

        if (action === 'update-data') {
            // Обновление данных
            const { data: fileData } = await octokit.repos.getContent({
                owner,
                repo,
                path: 'data.json'
            });

            await octokit.repos.createOrUpdateFileContents({
                owner,
                repo,
                path: 'data.json',
                message: `Update league data: ${new Date().toISOString()}`,
                content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
                sha: fileData.sha
            });

            // Триггер пересборки на Vercel
            await fetch(`https://api.vercel.com/v1/integrations/deploy/${process.env.VERCEL_DEPLOY_HOOK}`, {
                method: 'POST'
            });

            return res.status(200).json({ success: true, message: 'Data updated and site is rebuilding' });
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (error) {
        console.error('GitHub API error:', error);
        return res.status(500).json({ error: error.message });
    }

};
