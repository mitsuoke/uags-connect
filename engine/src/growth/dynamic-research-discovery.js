// Generated from Engine. Run npm run build:portal; do not edit.
import { asPlainDataRecord } from '../validation/plain-data.js';
export const DYNAMIC_RESEARCH_VERSION = '1.0.0';
const CYCLE_KEYS = [
    'cycleId', 'marketRef', 'targetMetric', 'internalEvidenceRefs',
    'publicCategory', 'publicProblem', 'language',
    'maximumQueries', 'maximumCandidates', 'maximumPages'
];
/** Pure planning only: no search calls, evidence admission or write authority. */
export function buildDynamicResearchQueryPlan(input, options = { vocabulary: 'MANUFACTURING' }) {
    const row = exactRecord(input, CYCLE_KEYS, 'DynamicResearchCycle');
    const language = row.language;
    if (language !== 'en' && language !== 'ru')
        throw new Error('Unsupported research language.');
    if (!Array.isArray(row.internalEvidenceRefs) || row.internalEvidenceRefs.length > 50) {
        throw new Error('Internal evidence refs must be a bounded array.');
    }
    const refs = row.internalEvidenceRefs.map((ref) => machineRef(ref));
    if (new Set(refs).size !== refs.length)
        throw new Error('Duplicate internal evidence ref.');
    const category = publicPhrase(row.publicCategory);
    const problem = publicPhrase(row.publicProblem);
    const cycle = Object.freeze({
        cycleId: machineRef(row.cycleId),
        marketRef: machineRef(row.marketRef),
        targetMetric: machineRef(row.targetMetric),
        internalEvidenceRefs: Object.freeze([...refs].sort()),
        publicCategory: category,
        publicProblem: problem,
        language,
        maximumQueries: integer(row.maximumQueries, 6, 12),
        maximumCandidates: integer(row.maximumCandidates, 1, 50),
        maximumPages: integer(row.maximumPages, 1, 15)
    });
    if (cycle.maximumPages > cycle.maximumCandidates) {
        throw new Error('Page budget cannot exceed candidate budget.');
    }
    const families = [
        'COMMERCIAL_INTENT', 'CUSTOMER_PROBLEM', 'ADJACENT_CATEGORY',
        'INTERNATIONAL_PRACTICE', 'CONVERSION_MECHANISM', 'TRUST_PROOF',
        'PROCESS_TRANSPARENCY', 'MOBILE_USABILITY', 'FORM_FRICTION',
        'NEXT_STEP', 'PERFORMANCE', 'RECENT_PRACTICE'
    ];
    const terms = options.vocabulary === 'GENERAL'
        ? language === 'en'
            ? ['website enquiry examples', 'customer questions', 'alternative services',
                'international examples', 'conversion user experience', 'trust evidence',
                'service process next steps', 'mobile navigation', 'enquiry form',
                'what happens after enquiry', 'page speed accessibility', 'recent developments']
            : ['сайт обращение примеры', 'вопросы клиентов', 'альтернативные услуги',
                'международные примеры', 'конверсия удобство сайта', 'доверие доказательства',
                'этапы услуги следующий шаг', 'мобильная навигация', 'форма обращения',
                'что происходит после заявки', 'скорость сайта доступность', 'новые решения']
        : language === 'en'
            ? ['manufacturer request quote', 'customer questions', 'alternative suppliers',
                'international examples', 'conversion user experience', 'certification evidence',
                'manufacturing process timeline', 'mobile navigation', 'quotation form',
                'what happens after enquiry', 'page speed accessibility', 'recent developments']
            : ['производитель запрос расчёта', 'вопросы клиентов', 'альтернативные поставщики',
                'международные примеры', 'конверсия удобство сайта', 'сертификаты доказательства',
                'этапы производства сроки', 'мобильная навигация', 'форма запроса расчёта',
                'что происходит после заявки', 'скорость сайта доступность', 'новые решения'];
    const queries = families.slice(0, cycle.maximumQueries).map((family, index) => Object.freeze({ family, text: `${category} ${problem} ${terms[index]}` }));
    return Object.freeze({
        schemaVersion: DYNAMIC_RESEARCH_VERSION,
        cycle,
        status: refs.length === 0 ? 'RESEARCH_ONLY' : 'INTERNAL_EVIDENCE_REFERENCED',
        queries: Object.freeze(queries),
        externalContentTrust: 'UNTRUSTED_DATA',
        role: 'CONTEXT_ONLY'
    });
}
/** Lexical screening only. Fetch adapters must also validate DNS and redirects. */
export function canonicalizeResearchUrl(input) {
    if (typeof input !== 'string' || input.length > 2048 || /[\s\\]/u.test(input)) {
        throw new Error('Invalid public research URL.');
    }
    let url;
    try {
        url = new URL(input);
    }
    catch {
        throw new Error('Invalid public research URL.');
    }
    const host = url.hostname.toLowerCase().replace(/\.$/u, '');
    if (!['http:', 'https:'].includes(url.protocol)
        || url.username !== '' || url.password !== '' || url.port !== ''
        || !host.includes('.') || host.includes(':') || host.startsWith('[')
        || /^[\d.]+$/u.test(host)
        || /(?:^|\.)(?:localhost|local|internal|test|invalid|onion|home|lan)$/u.test(host)
        || host.endsWith('.arpa')
        || host.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label)))
        throw new Error('Research URL must identify a public hostname over HTTP(S).');
    url.hostname = host;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
        if (/^(?:utm_.+|gclid|fbclid|msclkid|yclid)$/iu.test(key))
            url.searchParams.delete(key);
    }
    // Preserve semantic parameter order and duplicate values; some sites depend on it.
    return Object.freeze({ url: url.href, hostname: host });
}
/** Compare to one prior-cycle baseline; hashes refer to normalized relevant content. */
export function classifyResearchSource(input) {
    const row = exactRecord(input, ['current', 'previous'], 'ResearchSourceComparison');
    if (!Array.isArray(row.previous) || row.previous.length > 500) {
        throw new Error('Previous source baseline must be bounded.');
    }
    const current = sourceSnapshot(row.current);
    const previous = row.previous.map(sourceSnapshot);
    const identities = previous.map((item) => item.url);
    if (new Set(identities).size !== identities.length) {
        throw new Error('Previous baseline has duplicate source identities.');
    }
    const same = previous.find((item) => item.url === current.url);
    const state = same
        ? same.contentHash === null || current.contentHash === null
            ? 'UNKNOWN_CHANGE_STATE'
            : same.contentHash === current.contentHash ? 'KNOWN_URL_UNCHANGED' : 'KNOWN_URL_CHANGED'
        : previous.some((item) => item.hostname === current.hostname)
            ? 'KNOWN_DOMAIN_NEW_URL' : 'NEW_DOMAIN';
    return Object.freeze({
        url: current.url, hostname: current.hostname, state,
        eligibleForResearch: true, externalContentTrust: 'UNTRUSTED_DATA'
    });
}
function sourceSnapshot(input) {
    const row = exactRecord(input, ['url', 'contentHash'], 'ResearchSourceSnapshot');
    if (row.contentHash !== null &&
        (typeof row.contentHash !== 'string' || !/^[a-f0-9]{64}$/u.test(row.contentHash))) {
        throw new Error('Content hash must be SHA-256 or null.');
    }
    return Object.freeze({ ...canonicalizeResearchUrl(row.url), contentHash: row.contentHash });
}
function exactRecord(input, keys, label) {
    const row = asPlainDataRecord(input, label);
    if (Object.keys(row).length !== keys.length || keys.some((key) => !Object.hasOwn(row, key))) {
        throw new Error(`${label} must contain exactly the contracted fields.`);
    }
    return row;
}
function machineRef(input) {
    if (typeof input !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9/_:.-]{0,199}$/u.test(input)) {
        throw new Error('Expected a bounded machine reference.');
    }
    return input;
}
function publicPhrase(input) {
    if (typeof input !== 'string' || input.trim().length < 2 || input.length > 160
        || !/^[\p{L}\p{N} ,()\-]+$/u.test(input)) {
        throw new Error('Expected a bounded reviewed public research phrase.');
    }
    return input.trim().replace(/ +/gu, ' ');
}
function integer(input, min, max) {
    if (typeof input !== 'number' || !Number.isSafeInteger(input) || input < min || input > max) {
        throw new Error('Research budget is outside the contracted bounds.');
    }
    return input;
}
