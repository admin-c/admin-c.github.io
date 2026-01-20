// Конфигурация
const API_URL = '/api/update-data';
const ADMIN_SECRET = 'Ali';
let leagueData = null;
let currentSHA = null;

// Проверка доступа
function checkAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const secret = urlParams.get('secret');
    
    if (secret !== ADMIN_SECRET) {
        document.getElementById('adminContent').innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background: rgba(0,0,0,0.8);">
                <div style="text-align: center; padding: 40px; background: rgba(255,51,102,0.1); border-radius: 20px; border: 2px solid #ff3366;">
                    <i class="fas fa-lock" style="font-size: 64px; color: #ff3366; margin-bottom: 20px;"></i>
                    <h1 style="color: #ff3366;">Доступ запрещён</h1>
                    <p style="color: #ccc; margin: 20px 0;">Неверный секретный ключ</p>
                    <p style="color: #888; font-size: 14px;">Используйте: /admin?secret=Ali</p>
                </div>
            </div>
        `;
        return false;
    }
    
    return true;
}

// Загрузка данных с GitHub
async function loadData() {
    showLoading(true, 'Загрузка данных с GitHub...');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'get-data',
                secret: ADMIN_SECRET
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`GitHub API Error: ${errorData.error || response.statusText}`);
        }
        
        const result = await response.json();
        
        // Сохраняем SHA для обновлений
        if (result._meta?.sha) {
            currentSHA = result._meta.sha;
        }
        
        // Убираем метаданные
        const { _meta, ...data } = result;
        leagueData = data;
        
        console.log('Data loaded from GitHub:', {
            teams: leagueData.teams?.length || 0,
            matches: leagueData.matches?.length || 0,
            news: leagueData.news?.length || 0,
            sha: currentSHA?.substring(0, 8) || 'none'
        });
        
        renderAdminPanel();
        showNotification('Данные загружены из GitHub', 'success');
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        
        // Fallback на локальные данные
        const localBackup = localStorage.getItem('leagueDataBackup');
        if (localBackup) {
            try {
                leagueData = JSON.parse(localBackup);
                showNotification('Используются локальные backup данные', 'warning');
                renderAdminPanel();
            } catch (e) {
                showError('Ошибка загрузки данных. Проверьте настройки GitHub.');
                renderErrorPanel(error);
            }
        } else {
            showError('Не удалось загрузить данные. Проверьте настройки GitHub.');
            renderErrorPanel(error);
        }
    } finally {
        showLoading(false);
    }
}

// Сохранение данных в GitHub
async function saveData() {
    if (!leagueData) {
        showError('Нет данных для сохранения');
        return;
    }
    
    showLoading(true, 'Сохранение в GitHub...');
    
    try {
        // Добавляем метаданные
        const dataToSave = {
            ...leagueData,
            _meta: {
                lastUpdated: new Date().toISOString(),
                updatedBy: 'admin-panel',
                version: '1.0.0'
            }
        };
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update-data',
                data: dataToSave,
                secret: ADMIN_SECRET
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Ошибка сохранения');
        }
        
        const result = await response.json();
        
        // Обновляем SHA
        if (result.commit?.sha) {
            currentSHA = result.commit.sha;
        }
        
        // Сохраняем локальный backup
        localStorage.setItem('leagueDataBackup', JSON.stringify(leagueData));
        
        showSuccess(`Данные сохранены в GitHub!<br><small>Commit: ${result.commit.sha.substring(0, 8)}</small>`);
        
        // Перезагружаем данные для получения нового SHA
        setTimeout(() => loadData(), 1000);
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        
        // Fallback: сохраняем локально
        localStorage.setItem('leagueDataBackup', JSON.stringify(leagueData));
        showWarning(`Ошибка GitHub: ${error.message}<br>Данные сохранены локально.`);
        
    } finally {
        showLoading(false);
    }
}

// Добавление команды
async function addTeam() {
    const name = document.getElementById('newTeamName')?.value.trim();
    const owner = document.getElementById('newTeamOwner')?.value.trim();
    const group = document.getElementById('newTeamGroup')?.value || 'A';
    
    if (!name || !owner) {
        showError('Заполните название команды и владельца');
        return;
    }
    
    // Проверка дубликата
    if (leagueData.teams.some(t => t.name.toLowerCase() === name.toLowerCase())) {
        showError('Команда с таким названием уже существует');
        return;
    }
    
    const newTeam = {
        id: 'team_' + Date.now(),
        name,
        owner,
        group,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalsDifference: 0,
        points: 0,
        registrationDate: new Date().toISOString(),
        status: 'active'
    };
    
    if (!leagueData.teams) leagueData.teams = [];
    leagueData.teams.push(newTeam);
    
    // Добавляем уведомление
    await addNotification(`Добавлена команда: ${name} (${owner})`);
    
    // Сохраняем изменения
    await saveData();
    
    // Очищаем форму
    if (document.getElementById('newTeamName')) {
        document.getElementById('newTeamName').value = '';
        document.getElementById('newTeamOwner').value = '';
    }
}

// Добавление новости
async function addNews() {
    const title = document.getElementById('newsTitle')?.value.trim();
    const content = document.getElementById('newsContent')?.value.trim();
    
    if (!title || !content) {
        showError('Заполните заголовок и текст новости');
        return;
    }
    
    const newNews = {
        id: 'news_' + Date.now(),
        title,
        content,
        date: new Date().toISOString(),
        pinned: false
    };
    
    if (!leagueData.news) leagueData.news = [];
    leagueData.news.unshift(newNews);
    
    await addNotification(`Добавлена новость: ${title}`);
    await saveData();
    
    if (document.getElementById('newsTitle')) {
        document.getElementById('newsTitle').value = '';
        document.getElementById('newsContent').value = '';
    }
}

// Добавление уведомления в админку
async function addNotification(message, type = 'info') {
    try {
        await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'add-notification',
                data: { message, type },
                secret: ADMIN_SECRET
            })
        });
    } catch (error) {
        console.error('Ошибка добавления уведомления:', error);
    }
}

// Создание backup
async function createBackup() {
    if (!confirm('Создать backup всех данных?')) return;
    
    showLoading(true, 'Создание backup...');
    
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'backup',
                secret: ADMIN_SECRET
            })
        });
        
        if (!response.ok) throw new Error('Ошибка создания backup');
        
        const result = await response.json();
        showSuccess(`Backup создан: ${result.backup}`);
        
    } catch (error) {
        showError(`Ошибка создания backup: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Очистка данных
async function clearAllData() {
    if (!confirm('ВНИМАНИЕ: Это удалит ВСЕ данные из GitHub! Продолжить?')) return;
    
    showLoading(true, 'Очистка данных...');
    
    try {
        leagueData = {
            teams: [],
            matches: [],
            news: [{
                id: "reset",
                title: "Данные сброшены",
                content: "Все данные были сброшены администратором.",
                date: new Date().toISOString()
            }],
            adminNotifications: [],
            settings: {
                prizePool: 500,
                startDate: "2026-01-24",
                matchDays: ["Суббота", "Воскресенье"]
            },
            lastUpdated: new Date().toISOString()
        };
        
        await saveData();
        showSuccess('Все данные очищены');
        
    } catch (error) {
        showError(`Ошибка очистки: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Рендер админ-панели
function renderAdminPanel() {
    if (!leagueData) return;
    
    document.getElementById('adminContent').innerHTML = `
        <div class="admin-container">
            <div class="admin-header">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <h1><i class="fas fa-crown"></i> Админ-панель Либилской Лиги</h1>
                        <p>GitHub синхронизация | ${new Date().toLocaleString('ru-RU')}</p>
                    </div>
                    <div style="text-align: right;">
                        <div style="background: rgba(0,255,136,0.2); padding: 10px 15px; border-radius: 10px; display: inline-block;">
                            <i class="fas fa-check-circle" style="color: #00ff88;"></i>
                            <span style="margin-left: 5px;">GitHub Connected</span>
                        </div>
                        <div style="margin-top: 5px; font-size: 12px; color: #888;">
                            SHA: ${currentSHA ? currentSHA.substring(0, 8) + '...' : '...'}
                        </div>
                    </div>
                </div>
                
                <div style="display: flex; gap: 15px; margin-top: 20px;">
                    <div class="stat-card">
                        <div class="stat-number">${leagueData.teams?.length || 0}</div>
                        <div class="stat-label">Команд</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${leagueData.matches?.length || 0}</div>
                        <div class="stat-label">Матчей</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${leagueData.news?.length || 0}</div>
                        <div class="stat-label">Новостей</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-number">${leagueData.adminNotifications?.filter(n => !n.read).length || 0}</div>
                        <div class="stat-label">Новых увед.</div>
                    </div>
                </div>
            </div>
            
            <div class="admin-grid">
                <!-- Управление командами -->
                <div class="admin-card">
                    <h3><i class="fas fa-users"></i> Управление командами</h3>
                    <div class="form-group">
                        <input type="text" id="newTeamName" class="admin-input" placeholder="Название команды" maxlength="30">
                        <input type="text" id="newTeamOwner" class="admin-input" style="margin-top: 10px;" placeholder="Владелец (никнейм)" maxlength="20">
                        <select id="newTeamGroup" class="admin-input" style="margin-top: 10px;">
                            <option value="A">Группа A</option>
                            <option value="B">Группа B</option>
                            <option value="C">Группа C</option>
                            <option value="D">Группа D</option>
                        </select>
                    </div>
                    <button onclick="addTeam()" class="admin-btn">
                        <i class="fas fa-plus"></i> Добавить команду
                    </button>
                    
                    <div class="teams-list" style="margin-top: 20px; max-height: 300px; overflow-y: auto;">
                        ${(leagueData.teams || []).map(team => `
                            <div class="team-item">
                                <div>
                                    <strong>${team.name}</strong>
                                    <div style="font-size: 12px; color: #888;">
                                        ${team.owner} | Гр. ${team.group} | ${team.points} очков
                                    </div>
                                </div>
                                <div>
                                    <button onclick="editTeam('${team.id}')" style="background: #00ccff; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer; margin-right: 5px;">
                                        <i class="fas fa-edit"></i>
                                    </button>
                                    <button onclick="deleteTeam('${team.id}')" style="background: #ff3366; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Новости -->
                <div class="admin-card">
                    <h3><i class="fas fa-newspaper"></i> Управление новостями</h3>
                    <div class="form-group">
                        <input type="text" id="newsTitle" class="admin-input" placeholder="Заголовок новости" maxlength="100">
                        <textarea id="newsContent" class="admin-input" style="margin-top: 10px; height: 120px;" placeholder="Текст новости" maxlength="500"></textarea>
                    </div>
                    <button onclick="addNews()" class="admin-btn">
                        <i class="fas fa-paper-plane"></i> Опубликовать новость
                    </button>
                    
                    <div style="margin-top: 20px;">
                        <h4>Последние новости:</h4>
                        ${(leagueData.news || []).slice(0, 3).map(news => `
                            <div style="background: rgba(255,255,255,0.05); padding: 10px; margin-bottom: 10px; border-radius: 8px;">
                                <strong>${news.title}</strong>
                                <div style="font-size: 12px; color: #888;">${new Date(news.date).toLocaleDateString('ru-RU')}</div>
                                <div style="font-size: 13px; margin-top: 5px;">${news.content.substring(0, 80)}...</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Уведомления -->
                <div class="admin-card">
                    <h3><i class="fas fa-bell"></i> Уведомления</h3>
                    <div style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                        ${(leagueData.adminNotifications || []).map(notif => `
                            <div class="notification-item ${notif.read ? 'read' : 'unread'}">
                                <div style="display: flex; justify-content: space-between;">
                                    <div>
                                        <strong>${notif.type === 'info' ? 'ℹ️' : notif.type === 'warning' ? '⚠️' : '✅'} ${notif.message}</strong>
                                        <div style="font-size: 11px; color: #888;">${new Date(notif.date).toLocaleString('ru-RU')}</div>
                                    </div>
                                    ${!notif.read ? `<span class="status-badge" style="background: #ffcc00; color: black; padding: 2px 8px; border-radius: 10px; font-size: 11px;">NEW</span>` : ''}
                                </div>
                            </div>
                        `).join('')}
                        ${(!leagueData.adminNotifications || leagueData.adminNotifications.length === 0) ? 
                            '<div style="text-align: center; color: #888; padding: 20px;">Нет уведомлений</div>' : ''}
                    </div>
                    <button onclick="markAllAsRead()" class="admin-btn" style="background: #ffcc00; color: black;">
                        <i class="fas fa-check-double"></i> Отметить всё как прочитанное
                    </button>
                </div>
                
                <!-- Действия -->
                <div class="admin-card">
                    <h3><i class="fas fa-tools"></i> Действия с данными</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button onclick="saveData()" class="admin-btn">
                            <i class="fas fa-save"></i> Сохранить в GitHub
                        </button>
                        <button onclick="createBackup()" class="admin-btn" style="background: #9c27b0;">
                            <i class="fas fa-database"></i> Создать Backup
                        </button>
                        <button onclick="exportData()" class="admin-btn" style="background: #2196f3;">
                            <i class="fas fa-download"></i> Экспорт данных
                        </button>
                        <button onclick="loadData()" class="admin-btn" style="background: #4caf50;">
                            <i class="fas fa-sync"></i> Обновить данные
                        </button>
                        <button onclick="clearAllData()" class="admin-btn" style="background: #ff3366;">
                            <i class="fas fa-trash"></i> Очистить ВСЕ данные
                        </button>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background: rgba(0,204,255,0.1); border-radius: 10px;">
                        <h4><i class="fas fa-info-circle"></i> Статус GitHub</h4>
                        <div style="font-size: 14px; color: #ccc;">
                            <p>✅ Переменные окружения настроены</p>
                            <p>✅ Репозиторий: ${process.env.GITHUB_REPO || 'admin-c/admin-c.github.io'}</p>
                            <p>📊 Данные синхронизируются автоматически</p>
                            <p>💾 SHA: ${currentSHA ? currentSHA.substring(0, 8) + '...' : 'не загружено'}</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 40px; padding: 25px; background: rgba(0,0,0,0.6); border-radius: 15px; border-left: 5px solid #00ff88;">
                <h3><i class="fas fa-code-branch"></i> GitHub API Status</h3>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-top: 15px;">
                    <div style="padding: 15px; background: rgba(0,255,136,0.1); border-radius: 10px;">
                        <div style="font-size: 12px; color: #888;">Репозиторий</div>
                        <div style="font-weight: 600; color: #00ff88;">${process.env.GITHUB_REPO || 'admin-c/admin-c.github.io'}</div>
                    </div>
                    <div style="padding: 15px; background: rgba(0,204,255,0.1); border-radius: 10px;">
                        <div style="font-size: 12px; color: #888;">Последнее обновление</div>
                        <div style="font-weight: 600; color: #00ccff;">${leagueData.lastUpdated ? new Date(leagueData.lastUpdated).toLocaleString('ru-RU') : 'Нет данных'}</div>
                    </div>
                    <div style="padding: 15px; background: rgba(255,193,7,0.1); border-radius: 10px;">
                        <div style="font-size: 12px; color: #888;">Версия данных</div>
                        <div style="font-weight: 600; color: #ffc107;">${leagueData.settings?.version || '1.0.0'}</div>
                    </div>
                    <div style="padding: 15px; background: rgba(156,39,176,0.1); border-radius: 10px;">
                        <div style="font-size: 12px; color: #888;">Призовой фонд</div>
                        <div style="font-weight: 600; color: #9c27b0;">€${leagueData.settings?.prizePool || 500}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Дополнительные функции
function markAllAsRead() {
    if (leagueData.adminNotifications) {
        leagueData.adminNotifications.forEach(n => n.read = true);
        saveData();
    }
}

function exportData() {
    const dataStr = JSON.stringify(leagueData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `league-export-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showSuccess('Данные экспортированы');
}

function deleteTeam(teamId) {
    if (!confirm('Удалить команду? Это действие нельзя отменить.')) return;
    
    leagueData.teams = leagueData.teams.filter(t => t.id !== teamId);
    addNotification(`Удалена команда: ${teamId}`);
    saveData();
}

function editTeam(teamId) {
    const team = leagueData.teams.find(t => t.id === teamId);
    if (!team) return;
    
    const newName = prompt('Новое название команды:', team.name);
    if (newName && newName.trim() !== '') {
        team.name = newName.trim();
        addNotification(`Отредактирована команда: ${newName}`);
        saveData();
    }
}

function renderErrorPanel(error) {
    document.getElementById('adminContent').innerHTML = `
        <div style="padding: 40px; text-align: center;">
            <div style="font-size: 64px; color: #ff3366; margin-bottom: 20px;">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <h1 style="color: #ff3366;">Ошибка подключения к GitHub</h1>
            <p style="color: #ccc; margin: 20px 0; max-width: 600px; margin-left: auto; margin-right: auto;">
                ${error.message || 'Не удалось подключиться к GitHub API'}
            </p>
            
            <div style="background: rgba(255,51,102,0.1); padding: 20px; border-radius: 10px; max-width: 600px; margin: 30px auto; text-align: left;">
                <h3><i class="fas fa-cog"></i> Проверьте настройки:</h3>
                <ol style="color: #ccc; line-height: 1.8;">
                    <li>Переменные окружения в Vercel:
                        <ul>
                            <li><code>GITHUB_TOKEN</code> - Personal Access Token с правами <strong>repo</strong></li>
                            <li><code>ADMIN_SECRET</code> - секретный ключ админки</li>
                            <li><code>GITHUB_REPO</code> - ваш репозиторий (owner/repo)</li>
                        </ul>
                    </li>
                    <li>Убедитесь, что токен не истёк</li>
                    <li>Проверьте название репозитория</li>
                    <li>Перезапустите деплой в Vercel</li>
                </ol>
            </div>
            
            <div style="margin-top: 30px;">
                <button onclick="loadData()" class="admin-btn" style="width: auto; padding: 12px 30px; margin: 5px;">
                    <i class="fas fa-sync"></i> Попробовать снова
                </button>
                <button onclick="useLocalData()" class="admin-btn" style="width: auto; padding: 12px 30px; margin: 5px; background: #ffcc00; color: black;">
                    <i class="fas fa-database"></i> Использовать локальные данные
                </button>
            </div>
        </div>
    `;
}

function useLocalData() {
    const localData = localStorage.getItem('leagueDataBackup');
    if (localData) {
        leagueData = JSON.parse(localData);
        showNotification('Используются локальные backup данные', 'warning');
        renderAdminPanel();
    } else {
        showError('Нет локальных backup данных');
    }
}

// Вспомогательные функции UI
function showLoading(show, message = 'Загрузка...') {
    let loader = document.getElementById('adminLoader');
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'adminLoader';
        loader.style.cssText = `
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.9);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-size: 20px;
            color: #00ff88;
            flex-direction: column;
            backdrop-filter: blur(5px);
        `;
        document.body.appendChild(loader);
    }
    
    loader.innerHTML = `
        <div class="loader-spinner" style="width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.1); border-top: 4px solid #00ff88; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px;"></div>
        <div>${message}</div>
    `;
    loader.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    
    const colors = {
        error: { bg: '#ff3366', icon: 'exclamation-circle' },
        success: { bg: '#00ff88', icon: 'check-circle' },
        warning: { bg: '#ffcc00', icon: 'exclamation-triangle' },
        info: { bg: '#00ccff', icon: 'info-circle' }
    };
    
    const config = colors[type] || colors.info;
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="fas fa-${config.icon}" style="font-size: 20px;"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: ${type === 'success' ? 'black' : 'white'}; font-size: 22px; cursor: pointer; padding: 0 5px;">×</button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 25px;
        right: 25px;
        padding: 18px 22px;
        background: ${config.bg};
        color: ${type === 'success' ? 'black' : 'white'};
        border-radius: 12px;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 20px;
        min-width: 320px;
        max-width: 500px;
        animation: slideInRight 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        box-shadow: 0 8px 25px rgba(0,0,0,0.4);
        font-weight: 500;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.animation = 'slideOutRight 0.3s forwards';
            setTimeout(() => notification.remove(), 300);
        }
    }, 5000);
}

// Алиасы для удобства
function showError(msg) { showNotification(msg, 'error'); }
function showSuccess(msg) { showNotification(msg, 'success'); }
function showWarning(msg) { showNotification(msg, 'warning'); }
function showInfo(msg) { showNotification(msg, 'info'); }

// Добавляем CSS стили
function addAdminStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        @keyframes slideInRight {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOutRight {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        .stat-card {
            background: rgba(255,255,255,0.05);
            padding: 15px 25px;
            border-radius: 12px;
            text-align: center;
            flex: 1;
        }
        
        .stat-number {
            font-size: 2.2rem;
            font-weight: 800;
            background: linear-gradient(45deg, #00ff88, #00ccff);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        
        .stat-label {
            color: #888;
            font-size: 0.9rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 5px;
        }
        
        .team-item, .notification-item {
            background: rgba(255,255,255,0.03);
            padding: 15px;
            margin-bottom: 10px;
            border-radius: 10px;
            border-left: 4px solid #00ff88;
            transition: all 0.3s;
        }
        
        .team-item:hover, .notification-item:hover {
            background: rgba(255,255,255,0.07);
            transform: translateX(5px);
        }
        
        .notification-item.unread {
            border-left-color: #ffcc00;
            background: rgba(255,204,0,0.05);
        }
        
        .admin-input {
            width: 100%;
            padding: 14px 16px;
            background: rgba(255,255,255,0.07);
            border: 2px solid rgba(255,255,255,0.15);
            border-radius: 10px;
            color: white;
            font-size: 16px;
            transition: all 0.3s;
            font-family: 'Montserrat', sans-serif;
        }
        
        .admin-input:focus {
            outline: none;
            border-color: #00ff88;
            box-shadow: 0 0 0 3px rgba(0,255,136,0.2);
            background: rgba(255,255,255,0.1);
        }
        
        .admin-btn {
            background: linear-gradient(45deg, #00ff88, #00ccaa);
            color: black;
            border: none;
            padding: 16px 24px;
            border-radius: 12px;
            cursor: pointer;
            font-weight: 700;
            font-size: 16px;
            width: 100%;
            margin-top: 15px;
            transition: all 0.3s;
            font-family: 'Montserrat', sans-serif;
            letter-spacing: 0.5px;
        }
        
        .admin-btn:hover {
            transform: translateY(-3px);
            box-shadow: 0 10px 25px rgba(0,255,136,0.3);
        }
        
        .admin-btn:active {
            transform: translateY(-1px);
        }
        
        .admin-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
            gap: 25px;
            margin: 30px 0;
        }
        
        .admin-card {
            background: rgba(0,0,0,0.5);
            padding: 25px;
            border-radius: 20px;
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
            box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }
        
        .admin-card h3 {
            color: #00ff88;
            margin-bottom: 20px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 1.3rem;
        }
        
        .admin-header {
            background: rgba(0,0,0,0.6);
            padding: 30px;
            border-radius: 20px;
            margin-bottom: 30px;
            border-left: 6px solid #00ff88;
            box-shadow: 0 10px 30px rgba(0,0,0,0.4);
        }
        
        .form-group {
            margin-bottom: 20px;
        }
    `;
    document.head.appendChild(style);
}

// Инициализация
if (checkAccess()) {
    addAdminStyles();
    loadData();
    
    // Автообновление каждые 60 секунд
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadData();
        }
    }, 60000);
    
    // Обновление при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadData();
        }
    });
}
