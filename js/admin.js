// Конфигурация
const ADMIN_SECRET = 'Ali';
const API_URL = 'https://ваш-проект.vercel.app/api';

let leagueData = null;

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
                </div>
            </div>
        `;
        return false;
    }
    
    return true;
}

// Загрузка данных
async function loadData() {
    try {
        const response = await fetch(`${API_URL}/get-data`);
        leagueData = await response.json();
        renderAdminPanel();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        document.getElementById('adminContent').innerHTML = `
            <div class="access-denied">
                <div>
                    <i class="fas fa-exclamation-triangle"></i>
                    <h2>Ошибка загрузки данных</h2>
                    <p>${error.message}</p>
                </div>
            </div>
        `;
    }
}

// Рендер админ-панели
function renderAdminPanel() {
    if (!leagueData) return;
    
    document.getElementById('adminContent').innerHTML = `
        <div class="admin-header">
            <h1><i class="fas fa-crown"></i> Админ-панель Либилской Лиги</h1>
            <p>Управление лигой | Последнее обновление: ${new Date().toLocaleString()}</p>
            <div style="display: flex; gap: 15px; margin-top: 15px;">
                <div style="background: rgba(0, 255, 136, 0.2); padding: 10px 20px; border-radius: 10px;">
                    <strong>${leagueData.teams.length}</strong> команд
                </div>
                <div style="background: rgba(0, 204, 255, 0.2); padding: 10px 20px; border-radius: 10px;">
                    <strong>${leagueData.matches.length}</strong> матчей
                </div>
                <div style="background: rgba(255, 51, 102, 0.2); padding: 10px 20px; border-radius: 10px;">
                    <strong>${leagueData.adminNotifications?.filter(n => !n.read).length || 0}</strong> новых уведомлений
                </div>
            </div>
        </div>
        
        <div class="admin-grid">
            <!-- Управление командами -->
            <div class="admin-card">
                <h3><i class="fas fa-users"></i> Управление командами</h3>
                <div class="teams-list">
                    ${leagueData.teams.map(team => `
                        <div class="team-item">
                            <div>
                                <strong>${team.name}</strong>
                                <div style="font-size: 12px; color: #888;">${team.owner} | Группа ${team.group}</div>
                            </div>
                            <div>
                                <span style="background: rgba(0, 255, 136, 0.2); padding: 3px 10px; border-radius: 10px; font-size: 12px;">
                                    ${team.points} очков
                                </span>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <button onclick="addTeam()" class="admin-btn">
                    <i class="fas fa-plus"></i> Добавить команду
                </button>
            </div>
            
            <!-- Добавление новости -->
            <div class="admin-card">
                <h3><i class="fas fa-newspaper"></i> Добавить новость</h3>
                <div class="form-group">
                    <label>Заголовок новости</label>
                    <input type="text" id="newsTitle" class="admin-input" placeholder="Заголовок">
                </div>
                <div class="form-group">
                    <label>Текст новости</label>
                    <textarea id="newsContent" class="admin-input" rows="4" placeholder="Текст новости"></textarea>
                </div>
                <button onclick="addNews()" class="admin-btn">
                    <i class="fas fa-paper-plane"></i> Опубликовать новость
                </button>
            </div>
            
            <!-- Управление матчами -->
            <div class="admin-card">
                <h3><i class="fas fa-futbol"></i> Управление матчами</h3>
                <div class="form-group">
                    <label>Добавить матч</label>
                    <select id="homeTeam" class="admin-input">
                        <option value="">Выберите домашнюю команду</option>
                        ${leagueData.teams.map(team => `
                            <option value="${team.id}">${team.name}</option>
                        `).join('')}
                    </select>
                    <select id="awayTeam" class="admin-input" style="margin-top: 10px;">
                        <option value="">Выберите гостевую команду</option>
                        ${leagueData.teams.map(team => `
                            <option value="${team.id}">${team.name}</option>
                        `).join('')}
                    </select>
                    <div style="display: flex; gap: 10px; margin-top: 10px;">
                        <input type="number" id="homeScore" class="admin-input match-input" placeholder="Д">
                        <span style="align-self: center;">-</span>
                        <input type="number" id="awayScore" class="admin-input match-input" placeholder="Г">
                    </div>
                    <input type="datetime-local" id="matchDate" class="admin-input" style="margin-top: 10px;">
                </div>
                <button onclick="addMatch()" class="admin-btn">
                    <i class="fas fa-save"></i> Сохранить матч
                </button>
            </div>
            
            <!-- Уведомления -->
            <div class="admin-card">
                <h3><i class="fas fa-bell"></i> Уведомления о регистрациях</h3>
                <div class="news-list">
                    ${(leagueData.adminNotifications || []).map(notif => `
                        <div class="news-item ${notif.read ? '' : 'unread'}">
                            <div>
                                <strong>${notif.message}</strong>
                                <div style="font-size: 12px; color: #888;">${new Date(notif.date).toLocaleString()}</div>
                            </div>
                            ${!notif.read ? `
                                <span class="status-badge pending">Новое</span>
                            ` : `
                                <span class="status-badge confirmed">Просмотрено</span>
                            `}
                        </div>
                    `).join('')}
                </div>
                <button onclick="markAllAsRead()" class="admin-btn">
                    <i class="fas fa-check-double"></i> Отметить все как прочитанные
                </button>
            </div>
            
            <!-- Экстренные действия -->
            <div class="admin-card">
                <h3><i class="fas fa-tools"></i> Экстренные действия</h3>
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <button onclick="updateAllData()" class="admin-btn">
                        <i class="fas fa-sync"></i> Обновить все данные
                    </button>
                    <button onclick="resetTournament()" class="admin-btn delete">
                        <i class="fas fa-trash"></i> Сбросить турнир
                    </button>
                    <button onclick="backupData()" class="admin-btn">
                        <i class="fas fa-download"></i> Скачать backup данных
                    </button>
                </div>
            </div>
        </div>
        
        <div style="margin-top: 40px; padding: 20px; background: rgba(0,0,0,0.5); border-radius: 15px;">
            <h3><i class="fas fa-code"></i> Статус API</h3>
            <div style="display: flex; gap: 20px; margin-top: 15px;">
                <div style="padding: 10px 20px; background: rgba(0, 255, 136, 0.1); border-radius: 10px;">
                    <strong>GitHub API:</strong> <span style="color: #00ff88;">●</span> Работает
                </div>
                <div style="padding: 10px 20px; background: rgba(0, 204, 255, 0.1); border-radius: 10px;">
                    <strong>Vercel Functions:</strong> <span style="color: #00ccff;">●</span> Активны
                </div>
                <div style="padding: 10px 20px; background: rgba(255, 193, 7, 0.1); border-radius: 10px;">
                    <strong>Последняя синхронизация:</strong> 5 мин назад
                </div>
            </div>
        </div>
    `;
}

// Функции админ-панели
async function addNews() {
    const title = document.getElementById('newsTitle').value;
    const content = document.getElementById('newsContent').value;
    
    if (!title || !content) {
        alert('Заполните все поля');
        return;
    }
    
    const newNews = {
        id: Date.now().toString(),
        title,
        content,
        date: new Date().toISOString()
    };
    
    leagueData.news.unshift(newNews);
    await saveData();
    
    document.getElementById('newsTitle').value = '';
    document.getElementById('newsContent').value = '';
    
    alert('Новость добавлена!');
    renderAdminPanel();
}

async function addMatch() {
    const homeTeamId = document.getElementById('homeTeam').value;
    const awayTeamId = document.getElementById('awayTeam').value;
    const homeScore = parseInt(document.getElementById('homeScore').value) || 0;
    const awayScore = parseInt(document.getElementById('awayScore').value) || 0;
    const matchDate = document.getElementById('matchDate').value;
    
    if (!homeTeamId || !awayTeamId) {
        alert('Выберите команды');
        return;
    }
    
    if (homeTeamId === awayTeamId) {
        alert('Команда не может играть сама с собой');
        return;
    }
    
    const homeTeam = leagueData.teams.find(t => t.id === homeTeamId);
    const awayTeam = leagueData.teams.find(t => t.id === awayTeamId);
    
    const newMatch = {
        id: Date.now().toString(),
        homeTeam: homeTeam.name,
        awayTeam: awayTeam.name,
        homeScore,
        awayScore,
        date: matchDate || new Date().toISOString(),
        played: homeScore !== null && awayScore !== null,
        confirmed: false
    };
    
    // Обновляем статистику команд
    if (newMatch.played) {
        updateTeamStats(homeTeamId, awayTeamId, homeScore, awayScore);
    }
    
    leagueData.matches.push(newMatch);
    await saveData();
    
    // Сброс формы
    ['homeTeam', 'awayTeam', 'homeScore', 'awayScore', 'matchDate'].forEach(id => {
        document.getElementById(id).value = '';
    });
    
    alert('Матч добавлен!');
    renderAdminPanel();
}

function updateTeamStats(homeId, awayId, homeScore, awayScore) {
    const homeTeam = leagueData.teams.find(t => t.id === homeId);
    const awayTeam = leagueData.teams.find(t => t.id === awayId);
    
    if (!homeTeam || !awayTeam) return;
    
    // Обновляем домашнюю команду
    homeTeam.played++;
    homeTeam.goalsFor += homeScore;
    homeTeam.goalsAgainst += awayScore;
    homeTeam.goalsDifference = homeTeam.goalsFor - homeTeam.goalsAgainst;
    
    // Обновляем гостевую команду
    awayTeam.played++;
    awayTeam.goalsFor += awayScore;
    awayTeam.goalsAgainst += homeScore;
    awayTeam.goalsDifference = awayTeam.goalsFor - awayTeam.goalsAgainst;
    
    // Определяем результат
    if (homeScore > awayScore) {
        homeTeam.wins++;
        homeTeam.points += 3;
        awayTeam.losses++;
    } else if (homeScore < awayScore) {
        awayTeam.wins++;
        awayTeam.points += 3;
        homeTeam.losses++;
    } else {
        homeTeam.draws++;
        awayTeam.draws++;
        homeTeam.points += 1;
        awayTeam.points += 1;
    }
}

async function saveData() {
    try {
        // В реальном приложении здесь будет вызов API для сохранения
        // await fetch(`${API_URL}/update-data`, {...})
        
        // Для демонстрации сохраняем в localStorage
        localStorage.setItem('leagueDataBackup', JSON.stringify(leagueData));
        
        // Имитируем сохранение на сервер
        console.log('Данные сохранены:', leagueData);
        
    } catch (error) {
        console.error('Ошибка сохранения:', error);
        alert('Ошибка сохранения данных');
    }
}

function addTeam() {
    const teamName = prompt('Введите название команды:');
    if (!teamName) return;
    
    const ownerName = prompt('Введите имя владельца:');
    if (!ownerName) return;
    
    const group = prompt('Введите группу (A, B, C, D):', 'A');
    
    const newTeam = {
        id: Date.now().toString(),
        name: teamName,
        owner: ownerName,
        group: group.toUpperCase(),
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalsDifference: 0,
        points: 0,
        registrationDate: new Date().toISOString()
    };
    
    leagueData.teams.push(newTeam);
    saveData();
    renderAdminPanel();
}

function markAllAsRead() {
    if (leagueData.adminNotifications) {
        leagueData.adminNotifications.forEach(notif => notif.read = true);
        saveData();
        renderAdminPanel();
    }
}

function updateAllData() {
    loadData();
    alert('Данные обновлены!');
}

function resetTournament() {
    if (!confirm('ВЫ УВЕРЕНЫ? Это сбросит ВСЕ данные турнира!')) return;
    
    leagueData = {
        teams: [],
        matches: [],
        news: [],
        adminNotifications: []
    };
    
    saveData();
    renderAdminPanel();
}

function backupData() {
    const dataStr = JSON.stringify(leagueData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `league-backup-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

// Инициализация
if (checkAccess()) {
    loadData();
    // Автоматическое обновление каждые 30 секунд
    setInterval(loadData, 30000);
}