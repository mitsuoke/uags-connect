// Generated from Engine. Run npm run build:portal; do not edit.
import { asPlainDataRecord, hasOwnDataProperty, snapshotPlainData } from '../validation/plain-data.js';
export const UNIVERSAL_DOMAIN_SCHEMA_VERSION = '1.0.0';
export const ACTION_CAPABILITY_MODES = [
    'READ',
    'PREPARE',
    'APPLY',
    'VERIFY',
    'ROLLBACK'
];
const MACHINE_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_:.-]{0,199}$/;
function assertExactKeys(record, required, label) {
    const missing = required.filter((key) => !hasOwnDataProperty(record, key));
    if (missing.length > 0) {
        throw new Error(`${label} is missing required field(s): ${missing.join(', ')}.`);
    }
    const allowed = new Set(required);
    const unknown = Object.keys(record).filter((key) => !allowed.has(key));
    if (unknown.length > 0) {
        throw new Error(`${label} contains unknown field(s): ${unknown.sort().join(', ')}.`);
    }
}
function readMachineRef(value, label) {
    if (typeof value !== 'string'
        || value.trim().length === 0
        || !MACHINE_REF_PATTERN.test(value.trim())) {
        throw new Error(`${label} must be a normalized machine reference using letters, numbers, '/', '_', ':', '.', or '-'.`);
    }
    return value.trim();
}
function readNullableMachineRef(value, label) {
    if (value === null)
        return null;
    return readMachineRef(value, label);
}
function readArray(value, label, allowEmpty = true) {
    if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
        throw new Error(`${label} must be ${allowEmpty ? 'an array' : 'a non-empty array'}.`);
    }
    return value;
}
function readUniqueMachineRefArray(value, label, allowEmpty = true) {
    const parsed = readArray(value, label, allowEmpty).map((entry, index) => readMachineRef(entry, `${label}[${index}]`));
    if (new Set(parsed).size !== parsed.length) {
        throw new Error(`${label} must not contain duplicate values.`);
    }
    return Object.freeze(parsed);
}
function readActionCapabilityModes(value, label) {
    const modes = readArray(value, label, false).map((entry, index) => {
        if (typeof entry !== 'string'
            || !ACTION_CAPABILITY_MODES.includes(entry)) {
            throw new Error(`${label}[${index}] must be one of: ${ACTION_CAPABILITY_MODES.join(', ')}.`);
        }
        return entry;
    });
    if (new Set(modes).size !== modes.length) {
        throw new Error(`${label} must not contain duplicate modes.`);
    }
    return Object.freeze(modes);
}
function assertSameBusiness(actual, expected, label) {
    if (actual !== expected) {
        throw new Error(`${label}.businessId must equal ProjectProfile.businessId.`);
    }
}
function assertUniqueEntityRefs(items, select, label) {
    const seen = new Set();
    for (const item of items) {
        const ref = select(item);
        if (seen.has(ref)) {
            throw new Error(`${label} must not contain duplicate id ${ref}.`);
        }
        seen.add(ref);
    }
}
function assertKnownRefs(refs, known, label) {
    for (const ref of refs) {
        if (!known.has(ref)) {
            throw new Error(`${label} references unknown id ${ref}.`);
        }
    }
}
export function parseBusinessProfile(input) {
    const label = 'BusinessProfile';
    const record = asPlainDataRecord(input, label);
    assertExactKeys(record, [
        'businessId',
        'businessTypeRef',
        'outcomeRefs',
        'primaryOutcomeRef',
        'businessValueFlowRef'
    ], label);
    const outcomeRefs = readUniqueMachineRefArray(record.outcomeRefs, `${label}.outcomeRefs`, false);
    const primaryOutcomeRef = readMachineRef(record.primaryOutcomeRef, `${label}.primaryOutcomeRef`);
    if (!outcomeRefs.includes(primaryOutcomeRef)) {
        throw new Error('BusinessProfile.primaryOutcomeRef must be present in BusinessProfile.outcomeRefs.');
    }
    return Object.freeze({
        businessId: readMachineRef(record.businessId, `${label}.businessId`),
        businessTypeRef: readMachineRef(record.businessTypeRef, `${label}.businessTypeRef`),
        outcomeRefs,
        primaryOutcomeRef,
        businessValueFlowRef: readMachineRef(record.businessValueFlowRef, `${label}.businessValueFlowRef`)
    });
}
export function parseProperty(input) {
    const label = 'Property';
    const record = asPlainDataRecord(input, label);
    assertExactKeys(record, ['propertyId', 'businessId', 'propertyTypeRef', 'canonicalRef'], label);
    return Object.freeze({
        propertyId: readMachineRef(record.propertyId, `${label}.propertyId`),
        businessId: readMachineRef(record.businessId, `${label}.businessId`),
        propertyTypeRef: readMachineRef(record.propertyTypeRef, `${label}.propertyTypeRef`),
        canonicalRef: readMachineRef(record.canonicalRef, `${label}.canonicalRef`)
    });
}
export function parseConnection(input) {
    const label = 'Connection';
    const record = asPlainDataRecord(input, label);
    assertExactKeys(record, ['connectionId', 'businessId', 'providerRef', 'adapterRef', 'targetRef'], label);
    return Object.freeze({
        connectionId: readMachineRef(record.connectionId, `${label}.connectionId`),
        businessId: readMachineRef(record.businessId, `${label}.businessId`),
        providerRef: readMachineRef(record.providerRef, `${label}.providerRef`),
        adapterRef: readMachineRef(record.adapterRef, `${label}.adapterRef`),
        targetRef: readMachineRef(record.targetRef, `${label}.targetRef`)
    });
}
export function parseActionCapability(input) {
    const label = 'ActionCapability';
    const record = asPlainDataRecord(input, label);
    assertExactKeys(record, [
        'capabilityId',
        'businessId',
        'connectionId',
        'propertyId',
        'operationRef',
        'modes'
    ], label);
    return Object.freeze({
        capabilityId: readMachineRef(record.capabilityId, `${label}.capabilityId`),
        businessId: readMachineRef(record.businessId, `${label}.businessId`),
        connectionId: readMachineRef(record.connectionId, `${label}.connectionId`),
        propertyId: readNullableMachineRef(record.propertyId, `${label}.propertyId`),
        operationRef: readMachineRef(record.operationRef, `${label}.operationRef`),
        modes: readActionCapabilityModes(record.modes, `${label}.modes`)
    });
}
export function parseProjectBinding(input) {
    const label = 'ProjectBinding';
    const record = asPlainDataRecord(input, label);
    assertExactKeys(record, [
        'bindingId',
        'businessId',
        'semanticRef',
        'propertyIds',
        'connectionIds',
        'actionCapabilityIds'
    ], label);
    const propertyIds = readUniqueMachineRefArray(record.propertyIds, `${label}.propertyIds`);
    const connectionIds = readUniqueMachineRefArray(record.connectionIds, `${label}.connectionIds`);
    const actionCapabilityIds = readUniqueMachineRefArray(record.actionCapabilityIds, `${label}.actionCapabilityIds`);
    if (propertyIds.length === 0
        && connectionIds.length === 0
        && actionCapabilityIds.length === 0) {
        throw new Error('ProjectBinding must bind semanticRef to at least one property, connection, or action capability.');
    }
    return Object.freeze({
        bindingId: readMachineRef(record.bindingId, `${label}.bindingId`),
        businessId: readMachineRef(record.businessId, `${label}.businessId`),
        semanticRef: readMachineRef(record.semanticRef, `${label}.semanticRef`),
        propertyIds,
        connectionIds,
        actionCapabilityIds
    });
}
/**
 * Minimal provider-neutral domain boundary for Universal Autonomous Growth.
 *
 * This boundary defines identity and exact bindings only. It does not
 * evaluate Business Value Flow, admit Product Decision truth, grant policy
 * authorization, or alter existing FGN runtime behavior.
 */
export function parseProjectProfile(input) {
    const safe = snapshotPlainData(input, 'ProjectProfile');
    const label = 'ProjectProfile';
    const record = asPlainDataRecord(safe, label);
    assertExactKeys(record, [
        'schemaVersion',
        'projectId',
        'businessId',
        'businessProfile',
        'properties',
        'connections',
        'actionCapabilities',
        'bindings'
    ], label);
    if (record.schemaVersion !== UNIVERSAL_DOMAIN_SCHEMA_VERSION) {
        throw new Error(`ProjectProfile.schemaVersion must equal ${UNIVERSAL_DOMAIN_SCHEMA_VERSION}.`);
    }
    const projectId = readMachineRef(record.projectId, 'ProjectProfile.projectId');
    const businessId = readMachineRef(record.businessId, 'ProjectProfile.businessId');
    const businessProfile = parseBusinessProfile(record.businessProfile);
    assertSameBusiness(businessProfile.businessId, businessId, 'BusinessProfile');
    const properties = Object.freeze(readArray(record.properties, 'ProjectProfile.properties', false).map(parseProperty));
    const connections = Object.freeze(readArray(record.connections, 'ProjectProfile.connections').map(parseConnection));
    const actionCapabilities = Object.freeze(readArray(record.actionCapabilities, 'ProjectProfile.actionCapabilities').map(parseActionCapability));
    const bindings = Object.freeze(readArray(record.bindings, 'ProjectProfile.bindings', false).map(parseProjectBinding));
    for (const property of properties) {
        assertSameBusiness(property.businessId, businessId, 'Property');
    }
    for (const connection of connections) {
        assertSameBusiness(connection.businessId, businessId, 'Connection');
    }
    for (const capability of actionCapabilities) {
        assertSameBusiness(capability.businessId, businessId, 'ActionCapability');
    }
    for (const binding of bindings) {
        assertSameBusiness(binding.businessId, businessId, 'ProjectBinding');
    }
    assertUniqueEntityRefs(properties, (property) => property.propertyId, 'ProjectProfile.properties');
    assertUniqueEntityRefs(connections, (connection) => connection.connectionId, 'ProjectProfile.connections');
    assertUniqueEntityRefs(actionCapabilities, (capability) => capability.capabilityId, 'ProjectProfile.actionCapabilities');
    assertUniqueEntityRefs(bindings, (binding) => binding.bindingId, 'ProjectProfile.bindings');
    assertUniqueEntityRefs(bindings, (binding) => binding.semanticRef, 'ProjectProfile.bindings.semanticRef');
    const propertyIds = new Set(properties.map((property) => property.propertyId));
    const connectionIds = new Set(connections.map((connection) => connection.connectionId));
    const capabilityIds = new Set(actionCapabilities.map((capability) => capability.capabilityId));
    for (const capability of actionCapabilities) {
        assertKnownRefs([capability.connectionId], connectionIds, `ActionCapability ${capability.capabilityId}.connectionId`);
        if (capability.propertyId !== null) {
            assertKnownRefs([capability.propertyId], propertyIds, `ActionCapability ${capability.capabilityId}.propertyId`);
        }
    }
    for (const binding of bindings) {
        assertKnownRefs(binding.propertyIds, propertyIds, `ProjectBinding ${binding.bindingId}.propertyIds`);
        assertKnownRefs(binding.connectionIds, connectionIds, `ProjectBinding ${binding.bindingId}.connectionIds`);
        assertKnownRefs(binding.actionCapabilityIds, capabilityIds, `ProjectBinding ${binding.bindingId}.actionCapabilityIds`);
    }
    return Object.freeze({
        schemaVersion: UNIVERSAL_DOMAIN_SCHEMA_VERSION,
        projectId,
        businessId,
        businessProfile,
        properties,
        connections,
        actionCapabilities,
        bindings
    });
}
