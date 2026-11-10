import { createPublicResearchProject, parsePublicResearchProject, planPublicResearchProject } from './engine/src/growth/generic-project-connection.js';

const storageKey = 'uags.public-projects.v1';
const receiptKey = 'uags.public-project-receipts.v1';
const pendingKeyPrefix = 'uags.public-project-pending.v1.';
const local = ['127.0.0.1', 'localhost'].includes(location.hostname)
  && document.querySelector('meta[name="uags-paid-test"]')?.content === '1';
const intakeUrl = local ? '/v1/public-projects' : 'https://uags-public-intake.fgn-9c244031b99b.workers.dev/v1/public-projects';
const projects = new Map();
const receipts = new Map();
const pendingKeys = new Map();
const sending = new Set();
const paidStates = new Map();
const paidBusy = new Set();
const paidLabels = { PAYMENT_PENDING: 'Ожидает оплаты', QUEUED: 'Оплата подтверждена · исследование в очереди',
  RUNNING: 'Исследование выполняется', READY: 'Отчёт готов', LIMITED: 'Отчёт готов частично',
  FAILED: 'Исследование не завершилось. Повторной оплаты не требуется.' };
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
function requestKey(id) {
  if (pendingKeys.has(id)) return pendingKeys.get(id);
  try {
    const saved = localStorage.getItem(pendingKeyPrefix + id);
    if (/^[a-f0-9]{64}$/u.test(saved ?? '')) {
      pendingKeys.set(id, saved);
      return saved;
    }
  } catch { /* The retry can still use its in-memory receipt. */ }
  const key = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  pendingKeys.set(id, key);
  try { localStorage.setItem(pendingKeyPrefix + id, key); } catch { /* Restricted storage. */ }
  return key;
}
async function send(project) {
  const id = project.profile.projectId;
  if (sending.has(id) || receipts.has(id)) return;
  sending.add(id); render();
  notify('План показан. Передаём публичную заявку UAGS…');
  try {
    const response = await fetch(intakeUrl, {
      method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer',
      cache: 'no-store', headers: { 'Content-Type': 'application/json', 'X-UAGS-Request-Key': requestKey(id) },
      body: JSON.stringify({ projectKey: project.projectKey, publicSiteUrl: project.publicSiteUrl,
        repository: project.repository, publicCategory: project.publicCategory,
        publicProblem: project.publicProblem,
        ...(project.desiredOutcome ? { desiredOutcome: project.desiredOutcome } : {}),
        language: project.language })
    });
    if (response.status === 429 || response.status === 503) {
      const error = (await response.json().catch(() => null))?.error;
      if (error === 'PREVIEW_PROJECT_LIMIT') {
        notify('Бесплатная выжимка для этого проекта уже запрошена. Откройте карточку в браузере, из которого отправили заявку.');
        return;
      }
      if (error === 'PREVIEW_PAUSED') {
        notify('Новые бесплатные выжимки временно приостановлены. План сохранён, а готовые выжимки доступны в карточках проектов.');
        return;
      }
      if (response.status === 429) {
        notify('Сейчас достигнут лимит заявок. План сохранён, повторите отправку позже.');
        return;
      }
    }
    if (response.status !== 202) throw new Error('Request rejected');
    const receipt = await response.json();
    if (receipt?.status !== 'RECEIVED' || receipt.researchStarted !== false
      || !/^[0-9a-f-]{36}$/i.test(receipt.requestId ?? '')) throw new Error('Invalid receipt');
    if (receipt.receiptToken !== undefined && !/^[a-f0-9]{64}$/u.test(receipt.receiptToken)) throw new Error('Invalid report receipt');
    receipts.set(id, receipt.receiptToken ? { requestId: receipt.requestId, token: receipt.receiptToken } : receipt.requestId);
    saveReceipts();
    notify(receipt.receiptToken ? `Заявка получена: ${receipt.requestId}. Статус доступен в карточке проекта.`
      : `Заявка получена: ${receipt.requestId}. Исследование ещё не начато.`);
    if (receipt.receiptToken) await updatePaid(id);
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
async function updatePaid(id, checkout = false) {
  const receipt = receipts.get(id);
  if (!receipt || typeof receipt === 'string' || paidBusy.has(id)) return;
  paidBusy.add(id);
  let refresh = false;
  try {
    const response = await fetch(`${intakeUrl}/${receipt.requestId}/${checkout ? 'checkout' : 'paid-report'}`, {
      method: checkout ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
      headers: { Authorization: `Bearer ${receipt.token}` }
    });
    if (!response.ok) throw new Error('Report request rejected');
    const data = await response.json();
    if (!Object.hasOwn(paidLabels, data.state)) throw new Error('Invalid report state');
    if (receipts.get(id) !== receipt) return;
    if (checkout && data.checkoutUrl) {
      const destination = new URL(data.checkoutUrl);
      if (destination.username || destination.password
        || (destination.protocol !== 'https:' && !(local && destination.origin === location.origin))) {
        throw new Error('Invalid checkout destination');
      }
      location.assign(destination.href);
      return;
    }
    if (checkout) { refresh = true; return; }
    paidStates.set(id, data);
  } catch {
    if (receipts.get(id) === receipt) paidStates.set(id, { error: true });
  } finally {
    paidBusy.delete(id); render();
    if (refresh) void updatePaid(id);
  }
}
function renderPaid(card, id) {
  const receipt = receipts.get(id);
  if (!receipt || typeof receipt === 'string') return;
  const state = paidStates.get(id);
  card.append(node('h4', local ? 'Полный отчёт · тестовый режим' : 'Полный отчёт'));
  if (!state || state.error) {
    card.append(node('p', state?.error ? 'Статус временно недоступен.' : 'Проверяем статус…'),
      button('Проверить статус отчёта', () => updatePaid(id)));
    return;
  }
  if (state.preview) {
    if (['QUEUED', 'RUNNING'].includes(state.preview.state)) card.append(node('p', 'Готовим бесплатную выжимку…'));
    else if (state.preview.report?.sections?.length) {
      appendReportSections(card, state.preview.report.sections);
      if (state.preview.report.capturedAt) card.append(node('p', `Проверено: ${new Date(state.preview.report.capturedAt).toLocaleString('ru')}`));
    } else if (state.preview.state === 'LIMITED') card.append(node('p', 'Бесплатная выжимка недоступна для этой заявки.'));
  }
  const checkoutPaused = state.state === 'PAYMENT_PENDING' && state.checkoutAvailable === false;
  card.append(node('p', checkoutPaused ? 'Оплата пока недоступна.' : paidLabels[state.state], 'paid-report-status'));
  if (state.state === 'PAYMENT_PENDING' && !checkoutPaused && state.offer) {
    const currency = new Intl.NumberFormat('ru', { style: 'currency', currency: state.offer.currency });
    const fractionDigits = currency.resolvedOptions().maximumFractionDigits;
    card.append(node('p', `${state.offer.scopeLabel} · ${currency.format(state.offer.amountMinor / 10 ** fractionDigits)}`),
      button(local ? 'Перейти к тестовой оплате' : 'Перейти к оплате', () => updatePaid(id, true)));
  }
  if (state.state === 'READY' || state.state === 'LIMITED') {
    appendReportSections(card, state.report?.sections ?? []);
  }
  if (typeof state.remedy === 'string' && state.remedy) card.append(node('p', state.remedy));
}
function appendReportSections(card, sections) {
    for (const section of sections) {
      card.append(node('h4', section.title), node('p', section.text));
      for (const value of section.sourceUrls ?? []) {
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
          const link = node('a', `Источник: ${url.hostname}`);
          link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer';
          card.append(link, document.createElement('br'));
        } catch { /* A malformed URL is not a report link. */ }
      }
    }
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
      node('p', paidStates.get(project.profile.projectId)?.state ? 'Заявка получена'
        : receipts.has(project.profile.projectId)
        ? 'Заявка получена · исследование ещё не начато'
        : sending.has(project.profile.projectId) ? 'Передаём заявку…' : 'План готов · заявка не передана', 'project-status'),
      node('p', project.publicProblem));
    renderPaid(card, project.profile.projectId);
    if (project.desiredOutcome) card.append(node('p', `Заявленная цель: ${project.desiredOutcome}`));
    if (project.repository) card.append(node('p', `Публичный репозиторий (не проверен): ${project.repository}`));
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
    extra.append(node('p', `Короткое имя проекта: ${project.projectKey}`));
    extra.append(button('Сохранить копию настроек', () => download(`${project.projectKey}.project.json`, project)),
      button('Сохранить копию плана', () => download(`${project.projectKey}.plan.json`, plan)));
    card.append(extra);
    card.append(button('Удалить этот план', () => {
      projects.delete(project.profile.projectId); receipts.delete(project.profile.projectId);
      paidStates.delete(project.profile.projectId);
      pendingKeys.delete(project.profile.projectId);
      try { localStorage.removeItem(pendingKeyPrefix + project.profile.projectId); } catch { /* Restricted storage. */ }
      save(); saveReceipts(); render();
    }, 'danger'));
    container.append(card);
  }
}
function add(project) {
  if (projects.has(project.profile.projectId)) {
    throw new Error('Короткое имя проекта уже используется в этом браузере.');
  }
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
    fields.repository = fields.repository.trim() || null;
    fields.projectKey = fields.projectKey.trim() || nextProjectKey(fields.publicSiteUrl);
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
  if (raw && raw.length > 4096) throw new Error('Storage limit');
  const saved = raw ? JSON.parse(raw) : [];
  if (!Array.isArray(saved) || saved.length > 10) throw new Error('Storage format');
  for (const row of saved) {
    if (!Array.isArray(row) || row.length !== 2 || !projects.has(row[0])) throw new Error('Receipt format');
    const value = row[1];
    if (typeof value === 'string' && /^[0-9a-f-]{36}$/iu.test(value)) receipts.set(row[0], value);
    else if (value && /^[0-9a-f-]{36}$/iu.test(value.requestId ?? '') && /^[a-f0-9]{64}$/u.test(value.token ?? '')) {
      receipts.set(row[0], { requestId: value.requestId, token: value.token });
    } else throw new Error('Receipt format');
  }
} catch { receipts.clear(); }
render();
for (const [id, receipt] of receipts) if (typeof receipt !== 'string') void updatePaid(id);
setInterval(() => {
  if (document.hidden) return;
  for (const [id, state] of paidStates) {
    if (state.state === 'QUEUED' || state.state === 'RUNNING' || (state.state === 'PAYMENT_PENDING' && state.checkoutStarted)
      || ['QUEUED', 'RUNNING'].includes(state.preview?.state)) {
      void updatePaid(id);
    }
  }
}, 2000);
