import { createPublicResearchProject, parsePublicResearchProject, planPublicResearchProject } from './engine/src/growth/generic-project-connection.js';

const storageKey = 'uags.public-projects.v1';
const receiptKey = 'uags.public-project-receipts.v1';
const intakeUrl = 'https://uags-public-intake.fgn-9c244031b99b.workers.dev/v1/public-projects';
const projects = new Map();
const receipts = new Map();
const sending = new Set();
const message = document.querySelector('#message');
function notify(text) { message.textContent = text; }
function save() {
  try { localStorage.setItem(storageKey, JSON.stringify([...projects.values()])); return true; }
  catch { notify('План показан, но браузер не сохранил его для следующего посещения.'); return false; }
}
function saveReceipts() {
  try { localStorage.setItem(receiptKey, JSON.stringify([...receipts])); }
  catch { notify('Заявка получена, но браузер не сохранил номер для следующего посещения.'); }
}
async function send(project) {
  const id = project.profile.projectId;
  if (sending.has(id) || receipts.has(id)) return;
  sending.add(id); render();
  notify('План показан. Передаём публичную заявку UAGS…');
  try {
    const response = await fetch(intakeUrl, {
      method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectKey: project.projectKey, publicSiteUrl: project.publicSiteUrl,
        repository: null, publicCategory: project.publicCategory,
        publicProblem: project.publicProblem,
        ...(project.desiredOutcome ? { desiredOutcome: project.desiredOutcome } : {}),
        language: project.language })
    });
    if (response.status !== 202) throw new Error('Request rejected');
    const receipt = await response.json();
    if (receipt?.status !== 'RECEIVED' || receipt.researchStarted !== false
      || !/^[0-9a-f-]{36}$/i.test(receipt.requestId ?? '')) throw new Error('Invalid receipt');
    receipts.set(id, receipt.requestId); saveReceipts();
    notify(`Заявка получена: ${receipt.requestId}. Исследование ещё не начато.`);
  } catch { notify('План сохранён здесь, но заявка не передана. Повторите отправку на карточке сайта.'); }
  finally { sending.delete(id); render(); }
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
      node('p', receipts.has(project.profile.projectId)
        ? 'Заявка получена · исследование ещё не начато'
        : sending.has(project.profile.projectId) ? 'Передаём заявку…' : 'План готов · заявка не передана', 'project-status'),
      node('p', project.publicProblem));
    if (project.desiredOutcome) card.append(node('p', `Заявленная цель: ${project.desiredOutcome}`));
    if (!receipts.has(project.profile.projectId) && !sending.has(project.profile.projectId)) {
      card.append(button('Передать заявку UAGS', () => send(project)));
    }
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
      projects.delete(project.profile.projectId); receipts.delete(project.profile.projectId);
      save(); saveReceipts(); render();
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
document.querySelector('#project-form').addEventListener('submit', async event => {
  event.preventDefault();
  try {
    const fields = Object.fromEntries(new FormData(event.currentTarget));
    fields.repository = null;
    fields.projectKey = nextProjectKey(fields.publicSiteUrl);
    if (!fields.desiredOutcome.trim()) delete fields.desiredOutcome;
    const project = createPublicResearchProject(fields);
    add(project);
    await send(project);
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
try {
  const raw = localStorage.getItem(receiptKey);
  if (raw && raw.length > 2048) throw new Error('Storage limit');
  const saved = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(saved) || saved.length > 10) throw new Error('Storage format');
  for (const row of saved) {
    if (!Array.isArray(row) || row.length !== 2 || !projects.has(row[0])
      || typeof row[1] !== 'string' || !/^[0-9a-f-]{36}$/i.test(row[1])) throw new Error('Receipt format');
    receipts.set(row[0], row[1]);
  }
} catch { receipts.clear(); }
render();
