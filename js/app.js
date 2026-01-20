// Конфигурация API
const API_BASE_URL = 'https://champions-league-mu.vercel.app/api';
let currentUser = null;
let leagueData = null;

// DOM элементы
const registrationScreen = document.getElementById('registrationScreen');
const mainMenuScreen = document.getElementById('mainMenuScreen');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const installBtn = document.getElementById('installBtn');
const themeToggle = document.getElementById('themeToggle');
const notification = document.getElementById('notification');

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка темы
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.innerHTML = savedTheme === 'dark' ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    
    // Проверка пользователя
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    
    // Загрузка данных лиги
    await loadLeagueData();
    
    // Инициализация экрана
    if (currentUser) {
        showMainMenu();
    } else {
        showRegistration();
    }
    
    // Инициализация PWA
    initPWA();
});

// Загрузка данных лиги
async function loadLeagueData() {
    try {
        // В режиме разработки используем локальный файл
        const response = await fetch('data.json?v=' + Date.now());
        leagueData = await response.json();
        updateUIWithData();
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        showNotification('Ошибка загрузки данных лиги', 'error');
    }
}

// Обновление UI данными
function updateUIWithData() {
    if (!leagueData) return;
    
    // Обновляем счетчик команд
    const teamsCount = document.getElementById('teamsCount');
    if (teamsCount) {
        teamsCount.textContent = leagueData.teams.length;
    }
    
    // Обновляем данные пользователя
    if (currentUser) {
        const userTeam = leagueData.teams.find(t => t.id === currentUser.id);
        if (userTeam) {
            document.getElementById('userTeamName').textContent = userTeam.name;
            document.getElementById('userId').textContent = userTeam.id;
            document.getElementById('userPoints').textContent = userTeam.points;
            
            // Находим позицию в таблице
            const sortedTeams = [...leagueData.teams].sort((a, b) => b.points - a.points);
            const position = sortedTeams.findIndex(t => t.id === userTeam.id) + 1;
            document.getElementById('userPosition').textContent = position;
            
            // Обновляем прогресс
            const progressFill = document.querySelector('.progress-fill');
            if (progressFill) {
                const maxPoints = Math.max(...leagueData.teams.map(t => t.points));
                const width = maxPoints > 0 ? (userTeam.points / maxPoints) * 100 : 0;
                progressFill.style.width = `${width}%`;
            }
        }
    }
    
    // Обновляем новости
    const newsContainer = document.getElementById('newsContainer');
    if (newsContainer) {
        newsContainer.innerHTML = leagueData.news.slice(0, 3).map(news => `
            <div class="news-item">
                <div class="news-title">
                    <i class="fas fa-bullhorn"></i>
                    ${news.title}
                </div>
                <div class="news-date">${formatDate(news.date)}</div>
                <div class="news-content">${news.content}</div>
            </div>
        `).join('');
    }
    
    // Обновляем таблицу (если мы на странице таблицы)
    updateTablePage();
}

// Обновление страницы таблицы
function updateTablePage() {
    if (!leagueData || !document.querySelector('.table-container')) return;
    
    const tableContent = document.getElementById('tableContent');
    if (!tableContent) return;
    
    // Сортируем команды по очкам
    const sortedTeams = [...leagueData.teams].sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return b.goalsDifference - a.goalsDifference;
    });
    
    tableContent.innerHTML = `
        <table class="table">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Команда</th>
                    <th>И</th>
                    <th>В</th>
                    <th>Н</th>
                    <th>П</th>
                    <th>ЗМ</th>
                    <th>ПМ</th>
                    <th>РМ</th>
                    <th>О</th>
                </tr>
            </thead>
            <tbody>
                ${sortedTeams.map((team, index) => `
                    <tr class="${index < 2 ? 'qualified' : index >= sortedTeams.length - 2 ? 'eliminated' : ''}">
                        <td class="stats-cell">${index + 1}</td>
                        <td>
                            <div class="team-cell">
                                <div class="team-logo">${team.name.charAt(0)}</div>
                                <div>
                                    <span class="team-name">${team.name}</span>
                                    <span class="group-badge">${team.group}</span>
                                </div>
                            </div>
                        </td>
                        <td>${team.played}</td>
                        <td>${team.wins}</td>
                        <td>${team.draws}</td>
                        <td>${team.losses}</td>
                        <td>${team.goalsFor}</td>
                        <td>${team.goalsAgainst}</td>
                        <td class="stats-cell">${team.goalsDifference > 0 ? '+' : ''}${team.goalsDifference}</td>
                        <td class="stats-cell">${team.points}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    // Обновляем статистику
    document.getElementById('totalTeams').textContent = leagueData.teams.length;
    document.getElementById('playedMatches').textContent = leagueData.matches.filter(m => m.played).length;
    document.getElementById('totalGoals').textContent = leagueData.teams.reduce((sum, team) => sum + team.goalsFor, 0);
    document.getElementById('lastUpdate').textContent = `Обновлено: ${new Date().toLocaleTimeString()}`;
    
    // Добавляем обработчики фильтров
    document.querySelectorAll('.filter').forEach(filter => {
        filter.addEventListener('click', function() {
            document.querySelectorAll('.filter').forEach(f => f.classList.remove('active'));
            this.classList.add('active');
            
            const group = this.dataset.group;
            const rows = tableContent.querySelectorAll('tbody tr');
            
            rows.forEach(row => {
                const teamName = row.querySelector('.team-name').textContent;
                const team = leagueData.teams.find(t => t.name === teamName);
                
                if (group === 'all' || team.group === group) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        });
    });
}

// Регистрация команды
registerBtn?.addEventListener('click', async () => {
    const teamName = document.getElementById('teamName').value.trim();
    const ownerName = document.getElementById('ownerName').value.trim();
    
    if (!teamName || !ownerName) {
        showNotification('Заполните все поля', 'error');
        return;
    }
    
    if (teamName.length < 3) {
        showNotification('Название команды должно быть не менее 3 символов', 'error');
        return;
    }
    
    // Проверка существования команды
    if (leagueData.teams.some(t => t.name.toLowerCase() === teamName.toLowerCase())) {
        showNotification('Команда с таким названием уже зарегистрирована', 'error');
        return;
    }
    
    // Создание новой команды
    const newTeam = {
        id: generateId(),
        name: teamName,
        owner: ownerName,
        group: 'A', // Временная группа, будет определена при жеребьёвке
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
    
    try {
        // В реальном приложении здесь будет вызов API
        // await fetch(`${API_BASE_URL}/register`, {...})
        
        // Локальное сохранение
        leagueData.teams.push(newTeam);
        
        // Сохранение пользователя
        currentUser = { id: newTeam.id, teamName, ownerName };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        
        showNotification(`Команда "${teamName}" успешно зарегистрирована!`, 'success');
        
        // Отправка уведомления в админ-панель
        sendAdminNotification(`Новая регистрация: ${teamName} (${ownerName})`);
        
        // Обновление UI
        updateUIWithData();
        showMainMenu();
        
    } catch (error) {
        console.error('Ошибка регистрации:', error);
        showNotification('Ошибка регистрации', 'error');
    }
});

// Выход из аккаунта
logoutBtn?.addEventListener('click', () => {
    localStorage.removeItem('currentUser');
    currentUser = null;
    showRegistration();
    showNotification('Вы вышли из аккаунта');
});

// Переключение темы
themeToggle?.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    themeToggle.innerHTML = newTheme === 'dark' ? 
        '<i class="fas fa-moon"></i>' : 
        '<i class="fas fa-sun"></i>';
});

// Показ регистрации
function showRegistration() {
    if (registrationScreen && mainMenuScreen) {
        registrationScreen.classList.add('active');
        mainMenuScreen.classList.remove('active');
    }
}

// Показ главного меню
function showMainMenu() {
    if (registrationScreen && mainMenuScreen) {
        registrationScreen.classList.remove('active');
        mainMenuScreen.classList.add('active');
        updateUIWithData();
    }
}

// Уведомления
function showNotification(message, type = 'info') {
    notification.textContent = message;
    notification.className = 'notification';
    
    if (type === 'error') {
        notification.style.background = 'linear-gradient(45deg, #ff3366, #ff0066)';
    } else if (type === 'success') {
        notification.style.background = 'linear-gradient(45deg, #00ff88, #00ccaa)';
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Отправка уведомления в админку
function sendAdminNotification(message) {
    // В реальном приложении здесь будет вызов API для отправки уведомления
    console.log('Admin notification:', message);
    
    // Добавляем в локальные данные для демонстрации
    if (leagueData) {
        leagueData.adminNotifications = leagueData.adminNotifications || [];
        leagueData.adminNotifications.push({
            id: generateId(),
            message,
            date: new Date().toISOString(),
            read: false
        });
    }
}

// Генерация ID
function generateId() {
    return Math.random().toString(36).substr(2, 9);
}

// Форматирование даты
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

// PWA функционал
function initPWA() {
    let deferredPrompt;
    
    // Событие перед установкой
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        if (installBtn) {
            installBtn.style.display = 'flex';
            
            installBtn.addEventListener('click', async () => {
                if (!deferredPrompt) return;
                
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                
                if (outcome === 'accepted') {
                    showNotification('Приложение успешно установлено!', 'success');
                    installBtn.style.display = 'none';
                }
                
                deferredPrompt = null;
            });
        }
    });
    
    // Регистрация Service Worker
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js')
                .then(registration => {
                    console.log('ServiceWorker зарегистрирован:', registration);
                })
                .catch(error => {
                    console.log('Ошибка регистрации ServiceWorker:', error);
                });
        });
    }

}
