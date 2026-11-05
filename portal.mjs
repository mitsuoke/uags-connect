import { createPublicResearchProject, parsePublicResearchProject, planPublicResearchProject } from './engine/src/growth/generic-project-connection.js';

const storageKey = 'uags.public-projects.v1';
const projects = new Map();
const message = document.querySelector('#message');
function notify(text) { message.textContent = text; }
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify([...projects.values()])); return true; }
  catch { notify('Хранилище браузера недоступно. Профиль доступен до закрытия страницы — скачайте его.'); return false; }
}
function download(name, data) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function node(tag, text, className) {
  const item = document.createElement(tag); item.textContent = text;
  if (className) item.className = className;
  return item;
}
function button(text, callback, className = 'secondary') {
  const item = node('button', text, className); item.type = 'button'; item.addEventListener('click', callback); return item;
}
function render() {
  const container = document.querySelector('#projects'); container.replaceChildren();
  document.querySelector('#empty').hidden = projects.size > 0;
  for (const project of projects.values()) {
    const card = node('article', '', 'card project-card');
    card.append(node('h3', project.projectKey), node('p', project.publicSiteUrl, 'project-url'),
      node('p', 'Профиль настроен локально · исследование ещё не запущено', 'project-status'),
      node('p', project.publicProblem));
    const plan = planPublicResearchProject(project, 'initial');
    card.append(button('Сохранить настройки в файл', () => download(`${project.projectKey}.project.json`, project)),
      button('Сохранить план в файл', () => download(`${project.projectKey}.plan.json`, plan)));
    const details = document.createElement('details'); details.append(node('summary', 'Вопросы для исследования'));
    const list = document.createElement('ol');
    for (const query of plan.queries) list.append(node('li', query.text));
    details.append(list); card.append(details);
    card.append(button('Удалить локальный профиль', () => {
      projects.delete(project.profile.projectId); save(); render();
    }, 'danger'));
    container.append(card);
  }
}
function add(project) {
  if (projects.has(project.profile.projectId)) throw new Error('Это имя уже занято. Используйте другое имя или удалите прежний локальный профиль.');
  if (projects.size >= 10) throw new Error('В этом браузере можно хранить до 10 профилей.');
  projects.set(project.profile.projectId, project);
  if (save()) notify('Профиль сохранён в этом браузере. Скачайте его для импорта в Engine.');
  render();
}
document.querySelector('#project-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    fields.repository = fields.repository.trim() || null;
    add(createPublicResearchProject(fields));
  } catch (error) { notify('Проверьте настройки. ' + error.message); }
});
document.querySelector('#import-file').addEventListener('change', async event => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 65536) throw new Error('Файл слишком большой.');
    add(parsePublicResearchProject(JSON.parse(await file.text())));
  } catch { notify('Профиль не принят. Проверьте формат, размер и уникальность имени.'); }
  finally { event.target.value = ''; }
});
try {
  const raw = localStorage.getItem(storageKey);
  if (raw && raw.length > 65536) throw new Error('Storage limit');
  const saved = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(saved) || saved.length > 10) throw new Error('Storage format');
  for (const input of saved) {
    const project = parsePublicResearchProject(input);
    if (projects.has(project.profile.projectId)) throw new Error('Duplicate project');
    projects.set(project.profile.projectId, project);
  }
} catch { projects.clear(); notify('Сохранённые настройки не прочитаны. Можно импортировать скачанный профиль.'); }
render();
