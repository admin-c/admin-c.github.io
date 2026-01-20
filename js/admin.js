// Админ-панель - рабочая версия
const ADMIN_SECRET = 'Ali';
let leagueData = null;

// Проверка доступа
function checkAccess() {
    const urlParams = new URLSearchParams(window.location.search);
    const secret = urlParams.get('secret');
    
    if (secret !== ADMIN_SECRET) {
        document.getElementById('adminContent').innerHTML = `
            <div style="display: flex; justify-content: center; align-items: center; height: 100vh; font-size: 24px; color: #ff3366;">
                <div style="text-align: center;">
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

// Загрузка данных
async function loadData() {
    showLoading(true);
    
    try {
        const response = await fetch('/api/update-data', {
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
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        leagueData = result;
        
        renderAdminPanel();
        
    } catch (error) {
        console.error('Ошибка загрузки:', error);
        
        // Используем демо-данные
        leagueData = {
            teams: [
                {
                    id: "demo1",
                    name: "Реал Мадрид",
                    owner: "Alex",
                    group: "A",
                    played: 3,
                    wins: 2,
                    draws: 1,
                    losses: 0,
                    goalsFor: 7,
                    goalsAgainst: 2,
                    goalsDifference: 5,
                    points: 7,
                    registrationDate: new Date().toISOString()
                },
                {
                    id: "demo2",
                    name: "Барселона",
                    owner: "Mike",
                    group: "B",
                    played: 3,
                    wins: 3,
                    draws: 0,
                    losses: 0,
                    goalsFor: 9,
                    goalsAgainst: 1,
                    goalsDifference: 8,
                    points: 9,
                    registrationDate: new Date().toISOString()
                }
            ],
            matches: [
                {
                    id: "m1",
                    homeTeam: "Реал Мадрид",
                    awayTeam: "Барселона",
                    homeScore: 2,
                    awayScore: 2,
                    date: "2026-01-24T15:00:00Z",
                    stage: "Групповой этап",
                    played: true,
                    confirmed: true
                }
            ],
            news: [
                {
                    id: "1",
                    title: "Либилская Лига - Админ-панель",
                    content: "Административная панель успешно запущена. Вы можете управлять турниром.",
                    date: new Date().toISOString()
                }
            ],
            adminNotifications: []
        };
        
        showNotification('Используются демо-данные', 'info');
        renderAdminPanel();
        
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
                <h1><i class="fas fa-crown"></i> Админ-панель Либилской Лиги</h1>
                <p>Управление турниром | Демо-режим | ${new Date().toLocaleString()}</p>
                <div style="display: flex; gap: 15px; margin-top: 15px;">
                    <div style="background: rgba(0, 255, 136, 0.2); padding: 10px 20px; border-radius: 10px;">
                        <strong>${leagueData.teams.length}</strong> команд
                    </div>
                    <div style="background: rgba(0, 204, 255, 0.2); padding: 10px 20px; border-radius: 10px;">
                        <strong>${leagueData.matches.length}</strong> матчей
                    </div>
                    <div style="background: rgba(255, 193, 7, 0.2); padding: 10px 20px; border-radius: 10px;">
                        <strong>${leagueData.news.length}</strong> новостей
                    </div>
                </div>
            </div>
            
            <div class="admin-grid">
                <!-- Управление командами -->
                <div class="admin-card">
                    <h3><i class="fas fa-users"></i> Команды (${leagueData.teams.length})</h3>
                    <div class="teams-list" style="max-height: 300px; overflow-y: auto; margin-bottom: 20px;">
                        ${leagueData.teams.map(team => `
                            <div class="team-item">
                                <div>
                                    <strong>${team.name}</strong>
                                    <div style="font-size: 12px; color: #888;">
                                        ${team.owner} | Группа ${team.group} | ${team.points} очков
                                    </div>
                                </div>
                                <button onclick="deleteTeam('${team.id}')" style="background: #ff3366; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="form-group">
                        <input type="text" id="newTeamName" class="admin-input" placeholder="Название команды">
                        <input type="text" id="newTeamOwner" class="admin-input" style="margin-top: 10px;" placeholder="Владелец">
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
                </div>
                
                <!-- Новости -->
                <div class="admin-card">
                    <h3><i class="fas fa-newspaper"></i> Новости (${leagueData.news.length})</h3>
                    <div class="form-group">
                        <input type="text" id="newsTitle" class="admin-input" placeholder="Заголовок новости">
                        <textarea id="newsContent" class="admin-input" style="margin-top: 10px; height: 100px;" placeholder="Текст новости"></textarea>
                    </div>
                    <button onclick="addNews()" class="admin-btn">
                        <i class="fas fa-paper-plane"></i> Опубликовать новость
                    </button>
                    
                    <div style="margin-top: 20px; max-height: 200px; overflow-y: auto;">
                        ${leagueData.news.slice(0, 3).map(news => `
                            <div style="background: rgba(255,255,255,0.05); padding: 10px; margin-bottom: 10px; border-radius: 8px;">
                                <strong>${news.title}</strong>
                                <div style="font-size: 12px; color: #888;">${new Date(news.date).toLocaleDateString()}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <!-- Матчи -->
                <div class="admin-card">
                    <h3><i class="fas fa-futbol"></i> Матчи (${leagueData.matches.length})</h3>
                    <div class="form-group">
                        <select id="homeTeam" class="admin-input">
                            <option value="">Домашняя команда</option>
                            ${leagueData.teams.map(team => `
                                <option value="${team.id}">${team.name}</option>
                            `).join('')}
                        </select>
                        <select id="awayTeam" class="admin-input" style="margin-top: 10px;">
                            <option value="">Гостевая команда</option>
                            ${leagueData.teams.map(team => `
                                <option value="${team.id}">${team.name}</option>
                            `).join('')}
                        </select>
                        <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px;">
                            <input type="number" id="homeScore" class="admin-input" style="width: 60px; text-align: center;" placeholder="Д">
                            <span>:</span>
                            <input type="number" id="awayScore" class="admin-input" style="width: 60px; text-align: center;" placeholder="Г">
                        </div>
                        <input type="datetime-local" id="matchDate" class="admin-input" style="margin-top: 10px;">
                    </div>
                    <button onclick="addMatch()" class="admin-btn">
                        <i class="fas fa-save"></i> Добавить матч
                    </button>
                </div>
                
                <!-- Действия -->
                <div class="admin-card">
                    <h3><i class="fas fa-tools"></i> Действия</h3>
                    <div style="display: flex; flex-direction: column; gap: 10px;">
                        <button onclick="saveData()" class="admin-btn">
                            <i class="fas fa-save"></i> Сохранить все данные
                        </button>
                        <button onclick="location.reload()" class="admin-btn">
                            <i class="fas fa-sync"></i> Обновить данные
                        </button>
                        <button onclick="exportData()" class="admin-btn">
                            <i class="fas fa-download"></i> Экспорт данных
                        </button>
                        <button onclick="clearData()" class="admin-btn" style="background: #ff3366;">
                            <i class="fas fa-trash"></i> Очистить все данные
                        </button>
                    </div>
                    
                    <div style="margin-top: 20px; padding: 15px; background: rgba(255,193,7,0.1); border-radius: 10px;">
                        <h4><i class="fas fa-info-circle"></i> Информация</h4>
                        <p style="font-size: 14px; color: #ccc;">
                            Админ-панель работает в демо-режиме. Все изменения сохраняются временно.
                        </p>
                    </div>
                </div>
            </div>
            
            <div style="margin-top: 30px; padding: 20px; background: rgba(0,0,0,0.5); border-radius: 15px;">
                <h3><i class="fas fa-code"></i> Статус системы</h3>
                <div style="display: flex; gap: 20px; margin-top: 15px; flex-wrap: wrap;">
                    <div style="padding: 10px 20px; background: rgba(0, 255, 136, 0.1); border-radius: 10px;">
                        <strong>API:</strong> <span style="color: #00ff88;">●</span> Работает
                    </div>
                    <div style="padding: 10px 20px; background: rgba(0, 204, 255, 0.1); border-radius: 10px;">
                        <strong>Режим:</strong> Демо
                    </div>
                    <div style="padding: 10px 20px; background: rgba(255, 193, 7, 0.1); border-radius: 10px;">
                        <strong>Данные:</strong> Временные
                    </div>
                </div>
                <div style="margin-top: 15px; color: #888; font-size: 14px;">
                    <p>Для полноценной работы с GitHub API добавьте переменные окружения в Vercel:</p>
                    <code style="display: block; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 5px; margin-top: 5px;">
                        GITHUB_TOKEN, ADMIN_SECRET, GITHUB_REPO
                    </code>
                </div>
            </div>
        </div>
    `;
}

// Функции админ-панели
async function addTeam() {
    const name = document.getElementById('newTeamName').value.trim();
    const owner = document.getElementById('newTeamOwner').value.trim();
    const group = document.getElementById('newTeamGroup').value;
    
    if (!name || !owner) {
        showNotification('Заполните название и владельца', 'error');
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
        registrationDate: new Date().toISOString()
    };
    
    leagueData.teams.push(newTeam);
    showNotification(`Команда "${name}" добавлена`, 'success');
    renderAdminPanel();
}

async function addNews() {
    const title = document.getElementById('newsTitle').value.trim();
    const content = document.getElementById('newsContent').value.trim();
    
    if (!title || !content) {
        showNotification('Заполните заголовок и текст', 'error');
        return;
    }
    
    const newNews = {
        id: 'news_' + Date.now(),
        title,
        content,
        date: new Date().toISOString()
    };
    
    if (!leagueData.news) leagueData.news = [];
    leagueData.news.unshift(newNews);
    
    showNotification('Новость добавлена', 'success');
    renderAdminPanel();
}

async function addMatch() {
    const homeId = document.getElementById('homeTeam').value;
    const awayId = document.getElementById('awayTeam').value;
    const homeScore = parseInt(document.getElementById('homeScore').value) || 0;
    const awayScore = parseInt(document.getElementById('awayScore').value) || 0;
    const date = document.getElementById('matchDate').value || new Date().toISOString();
    
    if (!homeId || !awayId) {
        showNotification('Выберите обе команды', 'error');
        return;
    }
    
    if (homeId === awayId) {
        showNotification('Команда не может играть сама с собой', 'error');
        return;
    }
    
    const homeTeam = leagueData.teams.find(t => t.id === homeId);
    const awayTeam = leagueData.teams.find(t => t.id === awayId);
    
    const newMatch = {
        id: 'match_' + Date.now(),
        homeTeam: homeTeam.name,
        homeTeamId: homeId,
        awayTeam: awayTeam.name,
        awayTeamId: awayId,
        homeScore,
        awayScore,
        date,
        played: true,
        confirmed: true,
        stage: 'Групповой этап'
    };
    
    if (!leagueData.matches) leagueData.matches = [];
    leagueData.matches.push(newMatch);
    
    showNotification('Матч добавлен', 'success');
    renderAdminPanel();
}

function deleteTeam(teamId) {
    if (!confirm('Удалить команду?')) return;
    
    leagueData.teams = leagueData.teams.filter(t => t.id !== teamId);
    showNotification('Команда удалена', 'info');
    renderAdminPanel();
}

async function saveData() {
    showLoading(true, 'Сохранение...');
    
    try {
        const response = await fetch('/api/update-data', {
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
            throw new Error(`Ошибка сохранения: ${response.status}`);
        }
        
        const result = await response.json();
        showNotification('Данные сохранены', 'success');
        
        // Сохраняем локально как backup
        localStorage.setItem('leagueDataBackup', JSON.stringify(leagueData));
        
    } catch (error) {
        console.error('Ошибка:', error);
        showNotification('Ошибка сохранения. Данные сохранены локально.', 'error');
        localStorage.setItem('leagueDataBackup', JSON.stringify(leagueData));
    } finally {
        showLoading(false);
    }
}

function exportData() {
    const dataStr = JSON.stringify(leagueData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', `league-data-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showNotification('Данные экспортированы', 'success');
}

function clearData() {
    if (!confirm('Очистить ВСЕ данные? Это действие нельзя отменить.')) return;
    
    leagueData = {
        teams: [],
        matches: [],
        news: [],
        adminNotifications: []
    };
    
    localStorage.removeItem('leagueDataBackup');
    showNotification('Все данные очищены', 'warning');
    renderAdminPanel();
}

// Вспомогательные функции
function showLoading(show, message = 'Загрузка...') {
    let loader = document.getElementById('adminLoader');
    
    if (!loader) {
        loader = document.createElement('div');
        loader.id = 'adminLoader';
        loader.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 10000;
            font-size: 20px;
            color: #00ff88;
        `;
        document.body.appendChild(loader);
    }
    
    loader.innerHTML = `<div>${message}</div>`;
    loader.style.display = show ? 'flex' : 'none';
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    
    const colors = {
        error: '#ff3366',
        success: '#00ff88',
        warning: '#ffcc00',
        info: '#00ccff'
    };
    
    notification.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fas fa-${type === 'error' ? 'exclamation-circle' : type === 'success' ? 'check-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; font-size: 20px; cursor: pointer;">×</button>
    `;
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${colors[type]};
        color: ${type === 'success' ? 'black' : 'white'};
        border-radius: 10px;
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 15px;
        min-width: 300px;
        animation: slideIn 0.3s ease;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
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
    loadData();
    
    // Добавляем стили для анимации
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        .team-item {
            background: rgba(255,255,255,0.05);
            padding: 12px;
            margin-bottom: 10px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .admin-input {
            width: 100%;
            padding: 12px;
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            color: white;
            font-size: 16px;
        }
        
        .admin-btn {
            background: linear-gradient(45deg, #00ff88, #00ccff);
            color: black;
            border: none;
            padding: 12px;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 600;
            font-size: 16px;
            width: 100%;
            margin-top: 10px;
            transition: transform 0.3s;
        }
        
        .admin-btn:hover {
            transform: translateY(-2px);
        }
    `;
    document.head.appendChild(style);
}
