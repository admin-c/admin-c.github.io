// Конфигурация API
const API_URL = 'https://champions-league-mu.vercel.app/api/update-data';
const ADMIN_SECRET = 'Ali';
let leagueData = null;
let currentDataSHA = null;

// Проверка доступа
function checkAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const secret = urlParams.get('secret');
    
    if (secret !== ADMIN_SECRET) {
        document.getElementById('adminContent').innerHTML = `
            <div class="access-denied">
                <div>
                    <i class="fas fa-lock" style="font-size: 48px; margin-bottom: 20px;"></i>
                    <h2>Доступ запрещён</h2>
                    <p>Неверный секретный ключ</p>
                    <p style="margin-top: 20px; font-size: 14px; color: #888;">
                        Используйте: /admin?secret=Ali
                    </p>
                </div>
            </div>
        `;
        return false;
    }
    
    return true;
}

// Загрузка данных с обработкой ошибок
async function loadData() {
    try {
        showLoading(true);
        
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
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`HTTP ${response.status}: ${errorData.error || response.statusText}`);
        }
        
        const result = await response.json();
        
        // Сохраняем SHA для будущих обновлений
        if (result._meta?.sha) {
            currentDataSHA = result._meta.sha;
        }
        
        // Убираем мета-данные
        const { _meta, ...data } = result;
        leagueData = data;
        
        renderAdminPanel();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showError(`Ошибка загрузки: ${error.message}`);
        
        // Пробуем загрузить из локального хранилища
        const localData = localStorage.getItem('leagueDataBackup');
        if (localData) {
            try {
                leagueData = JSON.parse(localData);
                showWarning('Используются локальные данные из backup');
                renderAdminPanel();
            } catch (e) {
                showError('Не удалось загрузить даже локальные данные');
                renderEmptyAdminPanel();
            }
        } else {
            renderEmptyAdminPanel();
        }
    } finally {
        showLoading(false);
    }
}

// Сохранение данных
async function saveData() {
    if (!leagueData) {
        showError('Нет данных для сохранения');
        return;
    }
    
    try {
        showLoading(true, 'Сохранение данных...');
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'update-data',
                data: leagueData,
                secret: ADMIN_SECRET
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Ошибка сохранения: ${errorData.error || response.statusText}`);
        }
        
        const result = await response.json();
        
        // Обновляем SHA если есть
        if (result.newSha) {
            currentDataSHA = result.newSha;
        }
        
        showSuccess('Данные успешно сохранены на сервере!');
        
        // Обновляем интерфейс
        renderAdminPanel();
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        showError(`Ошибка сохранения: ${error.message}`);
        
        // Сохраняем локально как backup
        localStorage.setItem('leagueDataBackup', JSON.stringify(leagueData));
        showInfo('Данные сохранены локально как backup');
        
    } finally {
        showLoading(false);
    }
}

// Добавление команды
async function addTeam() {
    const teamName = document.getElementById('newTeamName').value.trim();
    const ownerName = document.getElementById('newTeamOwner').value.trim();
    const group = document.getElementById('newTeamGroup').value;
    
    if (!teamName || !ownerName) {
        showError('Заполните название команды и владельца');
        return;
    }
    
    // Проверка на дубликат
    if (leagueData.teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) {
        showError('Команда с таким названием уже существует');
        return;
    }
    
    const newTeam = {
        id: generateId(),
        name: teamName,
        owner: ownerName,
        group: group,
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
    
    leagueData.teams.push(newTeam);
    
    // Добавляем уведомление
    await addNotification(`Добавлена новая команда: ${teamName} (${ownerName})`, 'info');
    
    await saveData();
    
    // Очищаем форму
    document.getElementById('newTeamName').value = '';
    document.getElementById('newTeamOwner').value = '';
}

// Добавление новости
async function addNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    
    if (!title || !content) {
        showError('Заполните заголовок и текст новости');
        return;
    }
    
    const newNews = {
        id: generateId(),
        title,
        content,
        date: new Date().toISOString(),
        pinned: document.getElementById('newsPinned').checked
    };
    
    if (!leagueData.news) {
        leagueData.news = [];
    }
    
    leagueData.news.unshift(newNews);
    
    await addNotification(`Добавлена новость: ${title}`, 'info');
    await saveData();
    
    // Очищаем форму
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    document.getElementById('newsPinned').checked = false;
}

// Добавление матча
async function addMatch() {
    const homeTeam = document.getElementById('homeTeam').value;
    const awayTeam = document.getElementById('awayTeam').value;
    const homeScore = parseInt(document.getElementById('homeScore').value) || 0;
    const awayScore = parseInt(document.getElementById('awayScore').value) || 0;
    const matchDate = document.getElementById('matchDate').value || new Date().toISOString();
    const stage = document.getElementById('matchStage').value;
    
    if (!homeTeam || !awayTeam) {
        showError('Выберите обе команды');
        return;
    }
    
    if (homeTeam === awayTeam) {
        showError('Команда не может играть сама с собой');
        return;
    }
    
    const homeTeamData = leagueData.teams.find(t => t.id === homeTeam);
    const awayTeamData = leagueData.teams.find(t => t.id === awayTeam);
    
    if (!homeTeamData || !awayTeamData) {
        showError('Одна из команд не найдена');
        return;
    }
    
    const newMatch = {
        id: generateId(),
        homeTeam: homeTeamData.name,
        homeTeamId: homeTeam,
        awayTeam: awayTeamData.name,
        awayTeamId: awayTeam,
        homeScore,
        awayScore,
        date: matchDate,
        stage,
        played: homeScore !== null && awayScore !== null,
        confirmed: false,
        round: 'Групповой этап'
    };
    
    // Обновляем статистику команд если матч сыгран
    if (homeScore !== null && awayScore !== null) {
        updateTeamStats(homeTeam, awayTeam, homeScore, awayScore);
    }
    
    if (!leagueData.matches) {
        leagueData.matches = [];
    }
    
    leagueData.matches.push(newMatch);
    
    await addNotification(`Добавлен матч: ${homeTeamData.name} vs ${awayTeamData.data}`, 'info');
    await saveData();
    
    // Обновляем форму
    updateMatchForm();
}

// Обновление статистики команд
function updateTeamStats(homeId, awayId, homeScore, awayScore) {
    const homeTeam = leagueData.teams.find(t => t.id === homeId);
    const awayTeam = leagueData.teams.find(t => t.id === awayId);
    
    if (!homeTeam || !awayTeam) return;
    
    // Домашняя команда
    homeTeam.played += 1;
    homeTeam.goalsFor += homeScore;
    homeTeam.goalsAgainst += awayScore;
    homeTeam.goalsDifference = homeTeam.goalsFor - homeTeam.goalsAgainst;
    
    // Гостевая команда
    awayTeam.played += 1;
    awayTeam.goalsFor += awayScore;
    awayTeam.goalsAgainst += homeScore;
    awayTeam.goalsDifference = awayTeam.goalsFor - awayTeam.goalsAgainst;
    
    // Определение результата
    if (homeScore > awayScore) {
        homeTeam.wins += 1;
        homeTeam.points += 3;
        awayTeam.losses += 1;
    } else if (homeScore < awayScore) {
        awayTeam.wins += 1;
        awayTeam.points += 3;
        homeTeam.losses += 1;
    } else {
        homeTeam.draws += 1;
        awayTeam.draws += 1;
        homeTeam.points += 1;
        awayTeam.points += 1;
    }
}

// Добавление уведомления через API
async function addNotification(message, type = 'info') {
    try {
        if (!leagueData.adminNotifications) {
            leagueData.adminNotifications = [];
        }
        
        const notification = {
            id: generateId(),
            message,
            type,
            date: new Date().toISOString(),
            read: false
        };
        
        leagueData.adminNotifications.unshift(notification);
        
        // Также отправляем на сервер
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

// Отметить все уведомления как прочитанные
function markAllAsRead() {
    if (leagueData.adminNotifications) {
        leagueData.adminNotifications.forEach(n => n.read = true);
        saveData();
    }
}

// Получение статистики
async function getStats() {
    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'stats',
                secret: ADMIN_SECRET
            })
        });
        
        if (response.ok) {
            return await response.json();
        }
    } catch (error) {
        console.error('Ошибка получения статистики:', error);
    }
    
    // Fallback локальная статистика
    return {
        teams: leagueData.teams?.length || 0,
        matches: leagueData.matches?.length || 0,
        news: leagueData.news?.length || 0,
        notifications: leagueData.adminNotifications?.length || 0
    };
}

// Генерация ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Утилиты UI
function showLoading(show, message = 'Загрузка...') {
    const loader = document.getElementById('adminLoader') || createLoader();
    loader.innerHTML = `<div class="loader-message">${message}</div>`;
    loader.style.display = show ? 'flex' : 'none';
}

function createLoader() {
    const loader = document.createElement('div');
    loader.id = 'adminLoader';
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-size: 20px;
        color: var(--primary);
    `;
    document.body.appendChild(loader);
    return loader;
}

function showError(message) {
    showNotification(message, 'error');
}

function showSuccess(message) {
    showNotification(message, 'success');
}

function showWarning(message) {
    showNotification(message, 'warning');
}

function showInfo(message) {
    showNotification(message, 'info');
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `admin-notification admin-notification-${type}`;
    notification.innerHTML = `
        <div>${message}</div>
        <button onclick="this.parentElement.remove()">×</button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? 'rgba(255,51,102,0.9)' : 
                     type === 'success' ? 'rgba(0,255,136,0.9)' : 
                     type === 'warning' ? 'rgba(255,193,7,0.9)' : 
                     'rgba(0,204,255,0.9)'};
        color: ${type === 'success' ? 'black' : 'white'};
        border-radius: 10px;
        z-index: 10001;
        display: flex;
        align-items: center;
        gap: 15px;
        min-width: 300px;
        max-width: 500px;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Инициализация
if (checkAccess()) {
    // Загружаем данные сразу
    loadData();
    
    // Автоматическое обновление каждые 30 секунд
    setInterval(() => {
        if (document.visibilityState === 'visible') {
            loadData();
        }
    }, 30000);
    
    // Обновляем при возвращении на вкладку
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            loadData();
        }
    });
}
