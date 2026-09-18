// ═══════════ Telegram WebApp ═══════════
const tg = window.Telegram?.WebApp;
if (tg) {
    tg.ready();
    tg.expand();
    tg.setHeaderColor?.('#1c1c1e');
    tg.setBackgroundColor?.('#1c1c1e');
}

// ═══════════ Состояние ═══════════
const state = {
    catalog: {},
    currentClass: null,
    selected: new Set(),
    allBookIds: [],
};

const $ = id => document.getElementById(id);
const screens = {
    loading: $('loading'),
    class: $('classScreen'),
    books: $('bookScreen'),
    result: $('resultScreen'),
};

function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    window.scrollTo(0, 0);
}

// ═══════════ Загрузка каталога ═══════════
async function loadCatalog() {
    try {
        const res = await fetch('data.json');
        const data = await res.json();
        state.catalog = data;
        renderClasses();
        showScreen('class');
    } catch (e) {
        console.error('Ошибка загрузки каталога:', e);
        screens.loading.innerHTML =
            '<div class="empty"><div class="big">⚠️</div>' +
            '<p>Не удалось загрузить каталог</p></div>';
    }
}

// ═══════════ Классы ═══════════
function renderClasses() {
    const grid = $('classGrid');
    grid.innerHTML = '';
    const classes = Object.keys(state.catalog).sort((a, b) => a - b);
    if (!classes.length) {
        grid.innerHTML = '<div class="empty"><div class="big">📭</div>' +
                         '<p>Каталог пуст</p></div>';
        return;
    }
    classes.forEach(cls => {
        const count = state.catalog[cls].length;
        const card = document.createElement('div');
        card.className = 'class-card';
        card.innerHTML = `${cls} класс<small>${count} уч.</small>`;
        card.onclick = () => openClass(parseInt(cls));
        grid.appendChild(card);
    });
}

function openClass(cls) {
    state.currentClass = cls;
    state.allBookIds = [];
    $('classTitle').textContent = `${cls} класс`;
    renderBooks(cls);
    showScreen('books');
    updateSaveBar();
}

function bookKey(book) {
    return `${book.base_url}|${book.template}`;
}

function renderBooks(cls) {
    const list = $('bookList');
    list.innerHTML = '';
    const books = state.catalog[cls] || [];
    state.allBookIds = books.map(b => bookKey(b));

    if (!books.length) {
        list.innerHTML = '<div class="empty"><div class="big">📭</div>' +
                         '<p>Пока нет учебников для этого класса</p></div>';
        return;
    }

    books.forEach(book => {
        const key = bookKey(book);
        const isSel = state.selected.has(key);

        const card = document.createElement('div');
        card.className = 'book-card' + (isSel ? ' selected' : '');
        card.innerHTML = `
            <img class="book-thumb" src="${book.img || 'https://via.placeholder.com/60/3a3a3c/8e8e93?text=📖'}"
                 alt="" onerror="this.src='https://via.placeholder.com/60/3a3a3c/8e8e93?text=📖'">
            <div class="book-info">
                <div class="book-subject">${book.subject || 'предмет'}</div>
                <div class="book-name">${book.name}</div>
            </div>
            <div class="book-check">✓</div>
        `;
        card.onclick = () => toggleBook(card, book);
        list.appendChild(card);
    });
}

function toggleBook(card, book) {
    const key = bookKey(book);
    if (state.selected.has(key)) {
        state.selected.delete(key);
        card.classList.remove('selected');
    } else {
        state.selected.add(key);
        card.classList.add('selected');
        tg?.HapticFeedback?.impactOccurred?.('light');
    }
    updateSaveBar();
}

function updateSaveBar() {
    const bar = $('saveBar');
    const count = state.selected.size;
    $('selectedCount').textContent = count + ' выбрано';
    if (count > 0) bar.classList.remove('hidden');
    else bar.classList.add('hidden');
}

$('selectAllBtn').onclick = () => {
    const books = state.catalog[state.currentClass] || [];
    const keys = books.map(bookKey);
    const allSelected = keys.every(k => state.selected.has(k));
    if (allSelected) keys.forEach(k => state.selected.delete(k));
    else keys.forEach(k => state.selected.add(k));
    renderBooks(state.currentClass);
    updateSaveBar();
    tg?.HapticFeedback?.impactOccurred?.('medium');
};

$('backBtn').onclick = () => {
    showScreen('class');
    updateSaveBar();
};

$('saveBtn').onclick = () => {
    const chosen = [];
    Object.values(state.catalog).flat().forEach(book => {
        if (state.selected.has(bookKey(book))) {
            chosen.push({
                name: book.name,
                base_url: book.base_url,
                template: book.template,
                subject: book.subject || '',
            });
        }
    });
    if (!chosen.length) return;

    const payload = JSON.stringify({ action: 'add_books', books: chosen });
    if (tg) {
        tg.sendData(payload);
        showResult(chosen.length);
    } else {
        console.log('Выбрано:', chosen);
        showResult(chosen.length);
    }
};

function showResult(count) {
    $('resultIcon').textContent = '✅';
    $('resultTitle').textContent = 'Сохранено!';
    $('resultText').textContent =
        `Добавлено ${count} учебников в твой личный список. ` +
        `Вернись в бота и напиши «выбрать».`;
    showScreen('result');
    tg?.HapticFeedback?.notificationOccurred?.('success');
}

$('closeBtn').onclick = () => {
    if (tg) tg.close();
    else location.reload();
};

loadCatalog();