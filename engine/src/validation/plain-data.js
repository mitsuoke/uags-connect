// Generated from Engine. Run npm run build:portal; do not edit.
function fail(path, message) {
    throw new Error(`${path} ${message}`);
}
function isPlainObject(value) {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
}
function snapshotPlainDataValue(value, path, activeObjects) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        if (!Number.isFinite(value))
            return fail(path, 'must contain only finite numbers.');
        return value;
    }
    if (typeof value !== 'object') {
        return fail(path, `contains unsupported ${typeof value}; runtime input must be JSON-safe data.`);
    }
    if (activeObjects.has(value)) {
        return fail(path, 'contains a cyclic reference.');
    }
    activeObjects.add(value);
    try {
        if (Array.isArray(value)) {
            for (const key of Reflect.ownKeys(value)) {
                if (key === 'length')
                    continue;
                if (typeof key !== 'string')
                    return fail(path, 'must not contain symbol keys.');
                if (!/^(0|[1-9]\d*)$/.test(key)) {
                    return fail(path, `contains unsupported array property ${key}.`);
                }
            }
            const snapshot = [];
            for (let index = 0; index < value.length; index += 1) {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
                if (!descriptor)
                    return fail(`${path}[${index}]`, 'must not be a sparse array slot.');
                if (!('value' in descriptor)) {
                    return fail(`${path}[${index}]`, 'must be an own data property; accessors are not allowed.');
                }
                if (!descriptor.enumerable) {
                    return fail(`${path}[${index}]`, 'must be enumerable.');
                }
                snapshot.push(snapshotPlainDataValue(descriptor.value, `${path}[${index}]`, activeObjects));
            }
            return Object.freeze(snapshot);
        }
        if (!isPlainObject(value)) {
            return fail(path, 'must have Object.prototype or a null prototype.');
        }
        const snapshot = {};
        for (const key of Reflect.ownKeys(value)) {
            if (typeof key !== 'string')
                return fail(path, 'must not contain symbol keys.');
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (!descriptor || !('value' in descriptor)) {
                return fail(`${path}.${key}`, 'must be an own data property; accessors are not allowed.');
            }
            if (!descriptor.enumerable) {
                return fail(`${path}.${key}`, 'must be enumerable.');
            }
            const child = snapshotPlainDataValue(descriptor.value, `${path}.${key}`, activeObjects);
            Object.defineProperty(snapshot, key, {
                value: child,
                enumerable: true,
                writable: true,
                configurable: true
            });
        }
        return Object.freeze(snapshot);
    }
    finally {
        activeObjects.delete(value);
    }
}
export function snapshotPlainData(input, label) {
    return snapshotPlainDataValue(input, label, new WeakSet());
}
export function asPlainDataRecord(input, label) {
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
        throw new Error(`${label} must be a plain object.`);
    }
    return snapshotPlainData(input, label);
}
export function hasOwnDataProperty(record, key) {
    return Object.prototype.hasOwnProperty.call(record, key);
}
