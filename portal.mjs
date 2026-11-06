import { createPublicResearchProject, parsePublicResearchProject, planPublicResearchProject } from './engine/src/growth/generic-project-connection.js';

const storageKey = 'uags.public-projects.v1';
const projects = new Map();
const message = document.querySelector('#message');
function notify(text) { message.textContent = text; }
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify([...projects.values()])); return true; }
  catch { notify('План показан, но браузер не сохранил его для следующего посещения.'); return false; }
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
function nextProjectKey(siteUrl) {
  const host = new URL(siteUrl).hostname.replace(/^www\./, '');
  const base = 'site-' + host.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '').slice(0, 34);
  for (let index = 1; index <= 10; index++) {
    const key = index === 1 ? base : `${base}-${index}`;
    if (![...projects.values()].some(project => project.projectKey === key)) return key;
  }
  throw new Error('Слишком много планов для этого сайта в браузере.');
}
function render() {
  const container = document.querySelector('#projects'); container.replaceChildren();
  document.querySelector('#empty').hidden = projects.size > 0;
  for (const project of projects.values()) {
    const card = node('article', '', 'card project-card');
    card.append(node('h3', new URL(project.publicSiteUrl).hostname), node('p', project.publicSiteUrl, 'project-url'),
      node('p', 'План готов · исследование ещё не запущено', 'project-status'),
      node('p', project.publicProblem));
    if (project.desiredOutcome) card.append(node('p', `Заявленная цель: ${project.desiredOutcome}`));
    const plan = planPublicResearchProject(project, 'initial');
    const details = document.createElement('details'); details.open = true;
    details.append(node('summary', 'Первые вопросы для исследования'));
    const list = document.createElement('ol');
    for (const query of plan.queries) list.append(node('li', query.text));
    details.append(list); card.append(details);
    const extra = document.createElement('details'); extra.append(node('summary', 'Дополнительно'));
    extra.append(button('Сохранить копию настроек', () => download(`${project.projectKey}.project.json`, project)),
      button('Сохранить копию плана', () => download(`${project.projectKey}.plan.json`, plan)));
    card.append(extra);
    card.append(button('Удалить этот план', () => {
      projects.delete(project.profile.projectId); save(); render();
    }, 'danger'));
    container.append(card);
  }
}
function add(project) {
  if ([...projects.values()].some(saved => saved.publicSiteUrl === project.publicSiteUrl)) {
    throw new Error('План для этого сайта уже показан справа.');
  }
  if (projects.size >= 10) throw new Error('В этом браузере можно хранить до 10 планов.');
  projects.set(project.profile.projectId, project);
  if (save()) notify('План готов и сохранён в этом браузере.');
  render();
}
document.querySelector('#project-form').addEventListener('submit', event => {
  event.preventDefault();
  try {
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    fields.repository = null;
    fields.projectKey = nextProjectKey(fields.publicSiteUrl);
    add(createPublicResearchProject(fields));
  } catch (error) { notify('Проверьте настройки. ' + error.message); }
});
document.querySelector('#import-file').addEventListener('change', async event => {
  try {
    const file = event.target.files[0];
    if (!file) return;
    if (file.size > 65536) throw new Error('Файл слишком большой.');
    add(parsePublicResearchProject(JSON.parse(await file.text())));
  } catch { notify('Копию не удалось открыть. Проверьте файл или уже добавленный сайт.'); }
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
} catch { projects.clear(); notify('Сохранённые планы не удалось прочитать. Создайте план снова.'); }
render();
