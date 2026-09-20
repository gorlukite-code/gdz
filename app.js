const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready(); tg.expand();
  tg.setHeaderColor?.('#1c1c1e');
  tg.setBackgroundColor?.('#1c1c1e');
}

const state = {
  catalog: {},       // {class: [{subject, author, name, base_url, template, img, tasks_count}]}
  currentClass: null,
  currentSubject: null,
  query: '',
  selected: new Set(),  // "base_url|template"
  collapsed: {},        // "class|subject|author" -> true
};

const $ = id => document.getElementById(id);
const screens = { loading: $('loading'), class: $('classScreen'), result: $('resultScreen') };

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

function bookKey(b) { return `${b.base_url}|${b.template}`; }

// ═══ Загрузка ═══
async function loadCatalog() {
  try {
    const res = await fetch('data.json?v=' + Date.now(), { cache: 'no-store' });
    const data = await res.json();
    state.catalog = data || {};
    renderClassScreen();
    showScreen('class');
    $('searchWrap').classList.remove('hidden');
  } catch (e) {
    console.error(e);
    screens.loading.innerHTML =
      '<div class="empty"><div class="big">⚠️</div><p>Не удалось загрузить</p>' +
      '<button onclick="location.reload()" style="margin-top:14px;padding:12px 24px;border-radius:10px;border:none;background:#0a84ff;color:#fff;font-weight:600">Повторить</button></div>';
  }
}

// ═══ Экран с классами / предметами / книгами ═══
function renderClassScreen() {
  const cls = state.currentClass;
  const subj = state.currentSubject;

  // Breadcrumbs
  const crumbs = $('crumbs');
  let crHTML = '<span data-nav="root">Все классы</span>';
  if (cls) {
    crHTML += ' <span class="sep">›</span> <span data-nav="class">' + cls + ' класс</span>';
    if (subj) {
      crHTML += ' <span class="sep">›</span> <span data-nav="subject">' + subj + '</span>';
    }
  }
  crumbs.innerHTML = crHTML;
  crumbs.onclick = e => {
    const nav = e.target.dataset?.nav;
    if (nav === 'root') { state.currentClass = null; state.currentSubject = null; }
    else if (nav === 'class') { state.currentSubject = null; }
    renderClassScreen();
  };

  // Class grid
  const classGrid = $('classGrid');
  classGrid.innerHTML = '';
  if (!cls) {
    const classes = Object.keys(state.catalog).sort((a, b) => parseInt(a) - parseInt(b));
    if (!classes.length) {
      classGrid.innerHTML = '<div class="empty" style="grid-column:1/-1"><div class="big">📭</div><p>Каталог пуст</p></div>';
      $('subjectChips').classList.add('hidden');
      $('booksList').innerHTML = '';
      return;
    }
    classes.forEach(c => {
      const count = state.catalog[c].length;
      const d = document.createElement('div');
      d.className = 'class-card';
      d.innerHTML = `${c} класс<small>${count} уч.</small>`;
      d.onclick = () => { state.currentClass = c; state.currentSubject = null; renderClassScreen(); };
      classGrid.appendChild(d);
    });
    $('subjectChips').classList.add('hidden');
    $('booksList').innerHTML = '';
    return;
  }

  classGrid.style.display = 'none';

  // Subject chips
  const books = state.catalog[cls] || [];
  const subjects = {};
  books.forEach(b => { subjects[b.subject] = (subjects[b.subject] || 0) + 1; });
  const chips = $('subjectChips');
  chips.classList.remove('hidden');
  chips.innerHTML = '';

  const allChip = document.createElement('div');
  allChip.className = 'chip' + (state.currentSubject ? '' : ' active');
  allChip.innerHTML = 'Все предметы <small>' + books.length + '</small>';
  allChip.onclick = () => { state.currentSubject = null; renderClassScreen(); };
  chips.appendChild(allChip);

  Object.entries(subjects).sort().forEach(([s, cnt]) => {
    const c = document.createElement('div');
    c.className = 'chip' + (state.currentSubject === s ? ' active' : '');
    c.innerHTML = s + ' <small>' + cnt + '</small>';
    c.onclick = () => { state.currentSubject = s; renderClassScreen(); };
    chips.appendChild(c);
  });

  renderBooksList();
}

function renderBooksList() {
  const cls = state.currentClass;
  const list = $('booksList');
  list.innerHTML = '';
  if (!cls) return;

  let books = (state.catalog[cls] || []).slice();

  // Filter by subject
  if (state.currentSubject) {
    books = books.filter(b => b.subject === state.currentSubject);
  }

  // Filter by search
  const q = state.query.trim().toLowerCase();
  if (q) {
    books = books.filter(b => {
      return (b.name || '').toLowerCase().includes(q)
          || (b.author || '').toLowerCase().includes(q)
          || (b.subject || '').toLowerCase().includes(q);
    });
  }

  if (!books.length) {
    list.innerHTML = '<div class="empty"><div class="big">🔍</div><p>Ничего не найдено</p></div>';
    return;
  }

  // Group by author
  const groups = {};
  books.forEach(b => {
    const a = b.author || 'Прочее';
    (groups[a] = groups[a] || []).push(b);
  });

  Object.entries(groups).sort(([a], [b]) => a.localeCompare(b, 'ru')).forEach(([author, items]) => {
    const groupKey = `${cls}|${state.currentSubject || '*'}|${author}`;
    const collapsed = !!state.collapsed[groupKey];

    const g = document.createElement('div');
    g.className = 'author-group' + (collapsed ? ' collapsed' : '');

    const head = document.createElement('div');
    head.className = 'author-head';
    head.innerHTML = `<span class="arrow">▼</span><h3>${author}</h3><span class="count">${items.length}</span>`;
    head.onclick = () => {
      state.collapsed[groupKey] = !collapsed;
      renderBooksList();
    };
    g.appendChild(head);

    const body = document.createElement('div');
    body.className = 'author-books';
    items.forEach(b => body.appendChild(renderBookCard(b)));
    g.appendChild(body);

    list.appendChild(g);
  });
}

function renderBookCard(b) {
  const key = bookKey(b);
  const isSel = state.selected.has(key);
  const card = document.createElement('div');
  card.className = 'book-card' + (isSel ? ' selected' : '');

  const thumb = document.createElement('div');
  if (b.img) {
    thumb.className = 'book-thumb';
    thumb.style.backgroundImage = `url('${b.img}')`;
    thumb.style.backgroundSize = 'cover';
    thumb.style.backgroundPosition = 'center';
  } else {
    thumb.className = 'book-thumb placeholder';
    thumb.textContent = (b.subject || '?')[0] || '📖';
  }
  card.appendChild(thumb);

  const info = document.createElement('div');
  info.className = 'book-info';
  info.innerHTML = `<div class="book-name">${b.name}</div>
    <div class="book-meta">${b.subject || ''} · заданий: ${b.tasks_count || '—'}</div>`;
  card.appendChild(info);

  const infoBtn = document.createElement('button');
  infoBtn.className = 'book-info-btn';
  infoBtn.textContent = 'ⓘ';
  infoBtn.onclick = e => { e.stopPropagation(); openModal(b); };
  card.appendChild(infoBtn);

  const check = document.createElement('div');
  check.className = 'book-check';
  check.textContent = '✓';
  card.appendChild(check);

  card.onclick = () => {
    if (state.selected.has(key)) state.selected.delete(key);
    else state.selected.add(key);
    updateSaveBar();
    card.classList.toggle('selected');
    tg?.HapticFeedback?.impactOccurred?.('light');
  };
  return card;
}

function updateSaveBar() {
  const bar = $('saveBar');
  const n = state.selected.size;
  $('selectedCount').textContent = n + ' выбрано';
  bar.classList.toggle('hidden', n === 0);
}

// ═══ Поиск ═══
$('searchInput')?.addEventListener('input', e => {
  state.query = e.target.value;
  renderBooksList();
});

// ═══ Refresh ═══
$('refreshBtn')?.addEventListener('click', async () => {
  $('refreshBtn').textContent = '⏳';
  await loadCatalog();
  $('refreshBtn').textContent = '🔄';
});

// ═══ Modal ═══
let modalBook = null;
function openModal(b) {
  modalBook = b;
  $('modalImg').src = b.img || '';
  $('modalImg').style.display = b.img ? 'block' : 'none';
  $('modalSubject').textContent = b.subject || '';
  $('modalTitle').textContent = b.name || '';
  $('modalAuthor').textContent = b.author || '—';
  $('modalTpl').textContent = b.template || '—';
  $('modalTasks').textContent = b.tasks_count || '—';
  $('modalClass').textContent = state.currentClass || '—';
  $('modalLink').href = b.base_url || '#';
  $('modal').classList.remove('hidden');
}
$('modalClose').onclick = () => $('modal').classList.add('hidden');
$('modal').onclick = e => { if (e.target.id === 'modal') $('modal').classList.add('hidden'); };
$('modalSelect').onclick = () => {
  if (!modalBook) return;
  state.selected.add(bookKey(modalBook));
  updateSaveBar();
  $('modal').classList.add('hidden');
  renderBooksList();
  tg?.HapticFeedback?.impactOccurred?.('medium');
};

// ═══ Save ═══
$('saveBtn').onclick = () => {
  const chosen = [];
  Object.values(state.catalog).flat().forEach(b => {
    if (state.selected.has(bookKey(b))) {
      chosen.push({
        name: b.name,
        author: b.author || '',
        subject: b.subject || '',
        base_url: b.base_url,
        template: b.template,
      });
    }
  });
  if (!chosen.length) return;

  // sendData работает ТОЛЬКО в личке
  const chatType = tg?.initDataUnsafe?.chat_type;
  if (tg && chatType && chatType !== 'private') {
    alert('Сохранение работает только в личке с ботом.\n' +
          'Открой бота в личных сообщениях и повтори.');
    return;
  }

  const payload = JSON.stringify({ action: 'add_books', books: chosen });
  if (tg) {
    tg.sendData(payload);
    showResult(chosen.length);
  } else {
    console.log('Выбрано:', chosen);
    showResult(chosen.length);
  }
};

function showResult(n) {
  $('resultIcon').textContent = '✅';
  $('resultTitle').textContent = 'Сохранено!';
  $('resultText').textContent =
    `Добавлено ${n} учебников. Вернись в бота и напиши «выбрать».`;
  showScreen('result');
  tg?.HapticFeedback?.notificationOccurred?.('success');
}

$('closeBtn').onclick = () => { if (tg) tg.close(); else location.reload(); };

// ═══ Старт ═══
loadCatalog();
