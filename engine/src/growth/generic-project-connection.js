// Generated from Engine. Run npm run build:portal; do not edit.
import { asPlainDataRecord } from '../validation/plain-data.js';
import { parseProjectProfile } from '../domain/universal-domain-boundary.js';
import { canonicalizeResearchUrl, buildDynamicResearchQueryPlan } from './dynamic-research-discovery.js';
const FIELDS = ['projectKey', 'publicSiteUrl', 'repository', 'publicCategory', 'publicProblem', 'language'];
function exact(input, keys) {
    const row = asPlainDataRecord(input, 'PublicResearchProject');
    if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))) {
        throw new Error('Unexpected project fields. Use public configuration only.');
    }
    return row;
}
export function createPublicResearchProject(input) {
    const row = exact(input, FIELDS);
    const key = row.projectKey;
    if (typeof key !== 'string' || !/^[a-z][a-z0-9-]{1,47}$/.test(key)) {
        throw new Error('Project key must contain 2–48 lowercase letters, digits or hyphens.');
    }
    const site = canonicalizeResearchUrl(row.publicSiteUrl);
    const url = new URL(site.url);
    if (url.protocol !== 'https:' || new URL(row.publicSiteUrl).search || new URL(row.publicSiteUrl).hash) {
        throw new Error('Use a public HTTPS page without query parameters or fragments.');
    }
    const repository = row.repository;
    if (repository !== null && (typeof repository !== 'string'
        || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(repository)
        || repository.endsWith('.git')))
        throw new Error('Repository must be owner/name or null.');
    const businessId = `business:${key}`;
    const propertyId = `property:${key}:public-site`;
    const connectionId = `connection:${key}:public-web`;
    const capabilityId = `capability:${key}:public-research`;
    // Validate reviewed phrases and reuse the existing planner, rather than a second query model.
    const cycle = buildDynamicResearchQueryPlan({
        cycleId: `research:${key}:initial`, marketRef: `market:${key}`,
        targetMetric: 'website_enquiry_rate', internalEvidenceRefs: [],
        publicCategory: row.publicCategory, publicProblem: row.publicProblem, language: row.language,
        maximumQueries: 8, maximumCandidates: 50, maximumPages: 15
    }, { vocabulary: 'GENERAL' }).cycle;
    const profile = parseProjectProfile({
        schemaVersion: '1.0.0', projectId: `project:${key}:v1`, businessId,
        businessProfile: { businessId, businessTypeRef: 'business-type:website',
            outcomeRefs: ['outcome:website-enquiry'], primaryOutcomeRef: 'outcome:website-enquiry',
            businessValueFlowRef: `value-flow:${key}:unmapped` },
        properties: [{ propertyId, businessId, propertyTypeRef: 'property-type:website',
                canonicalRef: `web:${site.hostname}${url.pathname}` }],
        connections: [{ connectionId, businessId, providerRef: 'provider:public-web',
                adapterRef: 'adapter:session-public-research:v1', targetRef: `web:${site.hostname}${url.pathname}` }],
        actionCapabilities: [{ capabilityId, businessId, connectionId, propertyId,
                operationRef: 'operation:public-research:v1', modes: ['READ'] }],
        bindings: [{ bindingId: `binding:${key}:public-research`, businessId,
                semanticRef: 'semantic:website-research', propertyIds: [propertyId],
                connectionIds: [connectionId], actionCapabilityIds: [capabilityId] }]
    });
    return Object.freeze({ schemaVersion: '1.0.0', projectKey: key, publicSiteUrl: url.href,
        repository, publicCategory: cycle.publicCategory, publicProblem: cycle.publicProblem,
        language: cycle.language, profile });
}
export function parsePublicResearchProject(input) {
    const row = exact(input, ['schemaVersion', ...FIELDS, 'profile']);
    if (row.schemaVersion !== '1.0.0')
        throw new Error('Unsupported project version.');
    const parsed = createPublicResearchProject(Object.fromEntries(FIELDS.map(key => [key, row[key]])));
    const supplied = parseProjectProfile(row.profile);
    // Compare parsed, ordered fields: JSON key order in an uploaded file is irrelevant.
    if (JSON.stringify(supplied) !== JSON.stringify(parsed.profile)) {
        throw new Error('Project profile does not match its public settings or attempts to add capabilities.');
    }
    return parsed;
}
export function planPublicResearchProject(project, cycleLabel) {
    const parsed = parsePublicResearchProject(project);
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(cycleLabel))
        throw new Error('Invalid research cycle label.');
    return buildDynamicResearchQueryPlan({
        cycleId: `research:${parsed.projectKey}:${cycleLabel}`, marketRef: `market:${parsed.projectKey}`,
        targetMetric: 'website_enquiry_rate', internalEvidenceRefs: [],
        publicCategory: parsed.publicCategory, publicProblem: parsed.publicProblem, language: parsed.language,
        maximumQueries: 8, maximumCandidates: 50, maximumPages: 15
    }, { vocabulary: 'GENERAL' });
}
export function assertPublicProjectSession(project, input) {
    const row = asPlainDataRecord(input, 'ProjectSession');
    const plan = buildDynamicResearchQueryPlan(row.cycle, { vocabulary: 'GENERAL' });
    const prefix = `research:${project.projectKey}:`;
    const expected = planPublicResearchProject(project, plan.cycle.cycleId.slice(prefix.length));
    if (!plan.cycle.cycleId.startsWith(prefix)
        || plan.cycle.marketRef !== expected.cycle.marketRef
        || plan.cycle.targetMetric !== expected.cycle.targetMetric
        || plan.cycle.publicCategory !== expected.cycle.publicCategory
        || plan.cycle.publicProblem !== expected.cycle.publicProblem
        || plan.cycle.language !== expected.cycle.language
        || plan.cycle.internalEvidenceRefs.length !== 0) {
        throw new Error('Research session does not belong to this public project.');
    }
}
