import { ulidlc, uniq, sortBy as lodashSortBy, cloneDeep, pick, mapValues, defaultsDeep } from '@olibm/js1'
import { FirestoreCollectionHandler } from './FirestoreCollectionHandler'
import { RestCollectionHandler } from './RestCollectionHandler'
import { getFirebase } from '../../firebase'

export { setFirebase } from '../../firebase'
export * from './utils'
export * from './FirestoreCollectionHandler'
export * from './RestCollectionHandler'

let _defaultFirestore = null;
function getDefaultFirestore() {
    if (!_defaultFirestore) {
        _defaultFirestore = getFirebase().firestore();
    }
    return _defaultFirestore;
}

let bindCollectionDefaults = {};
export function setBindCollectionDefaults({ noTenantScope, useUserScope, softDelete, sortBy, collectionHandlerFactory, noCreatedAt, noUpdatedAt, noCreatedBy, noUpdatedBy, restClient, restBaseUrl, firestoreClient, noRefreshOnTenantIdChange, noRefreshOnUserIdChange, updateVer, listAllMax, queryParams }) {
    let patch = arguments[0];
    if (patch.collectionId) throw new Error('default value for collectionId is not supported');
    Object.assign(bindCollectionDefaults, patch);
    return bindCollectionDefaults;
}

export function patchDefaultQueryParams(patch) {
    bindCollectionDefaults.queryParams = Object.assign({}, bindCollectionDefaults.queryParams || {}, patch || {});
    return { ...bindCollectionDefaults.queryParams };
}

function defaultSortBy(row) {
    return (row.name || row.id).toLowerCase();
}

function fixDefault(key, value, fallbackDefault) {
    if (typeof value === 'undefined') {
        return typeof bindCollectionDefaults[key] !== 'undefined' ? bindCollectionDefaults[key] : fallbackDefault;
    }
    return value;
}

export const idChangedTriggers = [];
export function bindCollection(s, key, { collectionId, noTenantScope, useUserScope, softDelete, sortBy, collectionHandlerFactory, noCreatedAt, noUpdatedAt, noCreatedBy, noUpdatedBy, restClient, restBaseUrl, firestoreClient, noRefreshOnTenantIdChange, noRefreshOnUserIdChange, updateVer, queryParams } = {}) {
    if (typeof key == 'object') {
        key = key.key;
    }

    sortBy = fixDefault('sortBy', sortBy, defaultSortBy);
    if (typeof sortBy === 'string') {
        const kn = sortBy;
        sortBy = x => x[kn];
    }

    queryParams = queryParams || {};
    const prepareQueryParams = qp => {
        return Object.assign({}, bindCollectionDefaults.queryParams || {}, queryParams, qp);
    };

    let bindOpts = {
        ...(arguments[2] || {}),
        key,
        collectionId: collectionId = collectionId || key,
        noTenantScope: noTenantScope = fixDefault('noTenantScope', noTenantScope),
        useUserScope: useUserScope = fixDefault('useUserScope', useUserScope),
        softDelete: softDelete = fixDefault('softDelete', softDelete),
        sortBy,
        collectionHandlerFactory: collectionHandlerFactory = fixDefault('collectionHandlerFactory', collectionHandlerFactory),
        noCreatedAt: noCreatedAt = fixDefault('noCreatedAt', noCreatedAt),
        noUpdatedAt: noUpdatedAt = fixDefault('noUpdatedAt', noUpdatedAt),
        noCreatedBy: noCreatedBy = fixDefault('noCreatedBy', noCreatedBy),
        noUpdatedBy: noUpdatedBy = fixDefault('noUpdatedBy', noUpdatedBy),
        restClient: restClient = fixDefault('restClient', restClient),
        restBaseUrl: restBaseUrl = fixDefault('restBaseUrl', restBaseUrl),
        firestoreClient: firestoreClient = fixDefault('firestoreClient', firestoreClient, getDefaultFirestore()),
        noRefreshOnTenantIdChange: noRefreshOnTenantIdChange = fixDefault('noRefreshOnTenantIdChange', noRefreshOnTenantIdChange),
        noRefreshOnUserIdChange: noRefreshOnUserIdChange = fixDefault('noRefreshOnUserIdChange', noRefreshOnUserIdChange),
        updateVer: updateVer = fixDefault('updateVer', updateVer, 1),
        queryParams,
        prepareQueryParams,
    };


    if (!collectionHandlerFactory) {
        if (bindOpts.restClient) {
            bindOpts.collectionHandlerFactory = collectionHandlerFactory = function (bindOpts, user) {
                return new RestCollectionHandler(bindOpts, user);
            }
        } else {
            bindOpts.collectionHandlerFactory = collectionHandlerFactory = function (bindOpts, user) {
                return new FirestoreCollectionHandler(bindOpts, user);
            }
        }
    }

    let colHandler;

    let currentTenantId = 'none';
    let currentUserId = 'none';
    idChangedTriggers.push((user, store, promises) => {
        let { tenantId, userId } = user;
        colHandler = collectionHandlerFactory(bindOpts, user);

        let shouldRefresh, mustReset;

        if (currentTenantId !== tenantId) {
            currentTenantId = tenantId;
            if (tenantId === 'none') {
                mustReset = mustReset || !noRefreshOnTenantIdChange;
            }
            shouldRefresh = shouldRefresh || (!noRefreshOnTenantIdChange && s.state[`${key}Refreshed`]);
        }

        if (currentUserId !== userId) {
            currentUserId = userId;
            if (userId === 'none') {
                mustReset = mustReset || !noRefreshOnUserIdChange;
            }
            shouldRefresh = shouldRefresh || (!noRefreshOnUserIdChange && s.state[`${key}Refreshed`]);
        }

        let ns = s.js1ns ? `${s.js1ns}/` : '';
        if (mustReset) {
            if (process.env.DEV) console.log('idChangedTriggers mustReset', ns, key, { noRefreshOnTenantIdChange, noRefreshOnUserIdChange });
            (promises || []).push(store.commit(`${ns}${key}Reset`));
        }
        else if (shouldRefresh) {
            if (process.env.DEV) console.log('idChangedTriggers refresh', ns, key, { noRefreshOnTenantIdChange, noRefreshOnUserIdChange });
            (promises || []).push(store.dispatch(`${ns}${key}Refresh`, { reset: true }));
        }
    });

    function validateItem(item) {
        if (!item || Array.isArray(item) || typeof item !== 'object') {
            console.log('invalid item', item);
            throw new Error('invalid item');
        }
        if (!item || !item.id || typeof item.id !== 'string') {
            console.log('invalid item', item);
            throw new Error('invalid item id');
        }
    }

    if (!s.state) s.state = {};
    if (!s.mutations) s.mutations = {};
    if (!s.actions) s.actions = {};
    if (!s.getters) s.getters = {};

    s.state[key] = {};
    s.state[`${key}Trash`] = {};
    s.state[`${key}Appended`] = {};
    s.state[`${key}Refreshed`] = false;
    s.state[`${key}Busy`] = false;

    s.getters[`${key}Busy`] = state => state[`${key}Busy`] || !state[`${key}Refreshed`];
    s.getters[`${key}Loading`] = state => !state[`${key}Refreshed`];
    s.getters[`${key}Refreshed`] = state => state[`${key}Refreshed`];

    s.getters[`${key}FilterTags`] = function (state, getters) {
        return oneOfTags => {
            if (!Array.isArray(oneOfTags)) {
                throw new Error('oneOfTags must be array');
            }
            if (!oneOfTags.length) {
                return [];
            }
            return getters[`${key}Sorted`].filter(row => {
                return row.tags && row.tags.some(x => oneOfTags.includes(x));
            });
        }
    };

    s.getters[key] = function (state) {
        return Object.values(state[key]);
    };

    s.getters[`${key}ByKey`] = function (state) {
        return state[key];
    };

    s.getters[`${key}Sorted`] = function (state, getters) {
        return lodashSortBy(getters[key], sortBy);
    };

    s.mutations[`${key}SetBusy`] = function (state, value) {
        state[`${key}Busy`] = !!value;
    };

    s.mutations[`${key}Refresh`] = function (state, items) {
        let map = {};
        for (let item of items) {
            validateItem(item);
            map[item.id] = item;
        }
        state[key] = map;
        state[`${key}Refreshed`] = true;
    };

    s.mutations[`${key}Append`] = function (state, opts) {
        if (Array.isArray(opts)) {
            opts = { rows: opts };
        }
        let map = {};
        for (let item of opts.rows) {
            validateItem(item);
            map[item.id] = item;
        }
        state[key] = {
            ...state[key],
            ...map,
        };
        if (opts.appendedKey) {
            state[`${key}Appended`][opts.appendedKey] = true;
        }
        state[`${key}Refreshed`] = true;
    };

    s.mutations[`${key}Reset`] = function (state) {
        state[key] = {};
        state[`${key}Refreshed`] = false;
        state[`${key}Appended`] = {};
    };

    s.mutations[`${key}Set`] = function (state, item) {
        validateItem(item);
        if (softDelete && item.deleted) {
            state[`${key}Trash`][item.id] = item;
            return;
        }
        state[key] = {
            ...state[key],
            [item.id]: item,
        };
    };

    s.mutations[`${key}Remove`] = function (state, id) {
        delete state[key][id];
        state[key] = { ...state[key] };
    };

    s.actions[`${key}Get`] = async function (cx, opts) {
        if (typeof opts === 'string') {
            opts = { id: opts, once: true };
        }
        const { id, once } = opts;
        if (!id || typeof id !== 'string') {
            throw new Error('Invalid id for fbget');
        }
        const existingRow = cx.state[key][id];
        if (once && existingRow) {
            return existingRow;
        }

        let row = await colHandler.get(id).catch(err => {
            if (err.statusCode === 404) {
                if (opts.allowMissing) {
                    return;
                }
                err = new Error(`row does not exist: ${collectionId}/${id} (${key})`);
                err.statusCode = 404;
                throw err;
            }
            throw err;
        })
        if (!row) {
            return false;
        }
        cx.commit(`${key}Set`, row);
        return row;
    };

    s.actions[`${key}Refresh`] = async function (cx, opts) {
        try {
            if (process.env.DEV) console.log('refresh', key, { ...opts }, cx.state[`${key}Refreshed`]);
            cx.commit(`${key}SetBusy`, true);

            if (typeof opts === 'boolean') {
                opts = { blockOnce: opts };
            }
            opts = opts || {};

            let append = !!(opts.append || typeof opts.append === 'string'); // Empty string means true
            let appendedKey = typeof opts.append === 'string' && opts.append;

            let qp = prepareQueryParams(opts.queryParams);

            const refreshed = !!(cx.state[`${key}Refreshed`] && (!appendedKey || cx.state[`${key}Appended`][appendedKey]));

            if (!refreshed && opts.skipFirst) {
                return;
            }

            if (opts.once && refreshed) {
                return;
            }

            const prom = colHandler.listAll(qp).then(rows => {
                if (append) {
                    cx.commit(`${key}Append`, {
                        rows,
                        appendedKey,
                    });
                }
                else {
                    if (opts.reset) {
                        cx.commit(`${key}Reset`);
                    }
                    cx.commit(`${key}Refresh`, rows);
                }
            });

            if (refreshed && opts.blockOnce) {
                prom.catch(err => {
                    console.warn(`${key}Refresh failed but no error is thrown due to blockOnce`, err);
                });
            }
            else {
                await prom;
            }
        }
        finally {
            cx.commit(`${key}SetBusy`, false);
        }
    };

    s.actions[`${key}Create`] = async function (cx, item) {
        try {
            cx.commit(`${key}SetBusy`, true);
            if (softDelete) {
                item.deleted = item.deleted || 0;
            }
            if (!noCreatedAt) {
                if (!item.createdAt) {
                    item.createdAt = new Date().toISOString();
                }
                if (!item.updatedAt && !noUpdatedAt) {
                    item.updatedAt = item.createdAt;
                }
            }
            if (!noCreatedBy) {
                item.createdBy = currentUserId;
            }
            if (!noUpdatedBy) {
                item.updatedBy = currentUserId;
            }
            item = await colHandler.create(item);
            cx.commit(`${key}Set`, item);
            return item;
        }
        finally {
            cx.commit(`${key}SetBusy`, false);
        }
    };

    async function updateHelper(cx, item) {
        if (!noUpdatedAt) {
            item.updatedAt = new Date().toISOString();
        }
        if (!noUpdatedBy) {
            item.updatedBy = currentUserId;
        }
        await colHandler.patch(item.id, item);
    }

    s.actions[`${key}Update`] = async function (cx, item) {
        switch (updateVer) {
            case 1: return await cx.dispatch(`${key}Update1`, item);
            case 2: return await cx.dispatch(`${key}Update2`, item);
            default: throw new Error(`Unsupported updateVer ${updateVer}`)
        }
    };

    // Pros: Update1 fetches the updated object. Using rest the backend may change other fields based on your patch. If you need these changes you need to use Update1
    // Cons: Update1 may cause race conditions that overwrites concurrent patches. If you patch one field at the time on blur you should consider using Update2 instead
    s.actions[`${key}Update1`] = async function (cx, item) {
        try {
            cx.commit(`${key}SetBusy`, true);
            await updateHelper(cx, item);
            item = await colHandler.get(item.id);
            cx.commit(`${key}Set`, item);
            return item;
        }
        finally {
            cx.commit(`${key}SetBusy`, false);
        }
    };

    s.actions[`${key}Update2`] = async function (cx, item) {
        try {
            cx.commit(`${key}SetBusy`, true);
            await updateHelper(cx, item);
            let existingItem = cx.state[key][item.id];
            if (existingItem) {
                item = Object.assign(cloneDeep(existingItem), item);
            }
            else {
                item = await colHandler.get(item.id);
            }
            cx.commit(`${key}Set`, item);
            return item;
        }
        finally {
            cx.commit(`${key}SetBusy`, false);
        }
    };

    s.actions[`${key}UpdateAfterSet2`] = async function (cx, item) {
        let original = cx.state[key][item.id] || null;
        if (!original) {
            throw new Error(`UpdateAfterSet2 required the item to exist in state (${key}/${item.id})`);
        }
        let pickedOriginal = cloneDeep(pick(original, Object.keys(item)));
        cx.commit(`${key}Set`, {
            ...cloneDeep(original),
            ...cloneDeep(item),
        });
        try {
            return await cx.dispatch(`${key}Update2`, item);
        }
        catch (err) {
            if (cx.state[key][item.id]) {
                console.warn('UpdateAfterSet2 error. Reverting to original', key, item.id);
                cx.commit(`${key}Set`, {
                    ...cx.state[key][item.id],
                    ...pickedOriginal
                });
            }
            else {
                console.warn('UpdateAfterSet2 item is gone after error', key, item.id);
            }
            throw err;
        }
    };

    s.actions[`${key}Delete`] = async function (cx, id) {
        try {
            cx.commit(`${key}SetBusy`, true);
            if (typeof id === 'object') {
                id = id.id;
            }
            if (!id || typeof id !== 'string') {
                throw new Error('invalid id in delete');
            }
            if (softDelete) {
                let item = await cx.dispatch(`${key}Get`, id);
                item = {
                    ...item,
                    deleted: Date.now(),
                };
                await cx.dispatch(`${key}Update`, item);
            } else {
                await colHandler.delete(id);
            }
            cx.commit(`${key}Remove`, id)
        }
        finally {
            cx.commit(`${key}SetBusy`, false);
        }
    };
}

const expanders = {};
export function registerExpander(store, { key, collectionId, dependencies, expander, noCollectionIdDep }) {
    if (expanders[key]) {
        throw new Error(`expander key allready registered: ${key}`);
    }
    expanders[key] = {
        key,
        dependencies: [...dependencies],
    };

    const deps = () => {
        let deps = [...dependencies];
        dependencies.forEach(dep => {
            if (expanders[dep]) {
                deps.push(...expanders[dep].dependencies);
            }
        });
        if (deps.includes(key)) {
            deps = deps.filter(x => x != key);
            console.warn('circular dependency?', key);//TODO
        }
        if (!noCollectionIdDep) {
            deps.push(collectionId);
        }
        return uniq(deps);
    };

    const expanderKey = `${key}Expander`;
    const refreshedKey = `${key}Refreshed`;
    const loadingKey = `${key}Loading`;
    const busyKey = `${key}Busy`;
    const byKeyKey = `${key}ByKey`;

    store.getters[expanderKey] = expander;

    store.getters[refreshedKey] = (_, getters) => {
        return deps().every(dep => getters[`${dep}Refreshed`]);
    };

    store.getters[busyKey] = (_, getters) => {
        return deps().some(dep => getters[`${dep}Busy`]);
    };

    store.getters[loadingKey] = (_, getters) => !getters[refreshedKey]

    store.getters[byKeyKey] = (state, getters) => {
        let expander = getters[expanderKey];
        return mapValues(state[collectionId], x => expander(x.id));
    };

    store.getters[key] = (_, getters) => {
        return Object.values(getters[byKeyKey]);
    };

    store.actions[`${key}Refresh`] = async ({ dispatch }, opts) => {
        if (process.env.DEV) console.log('refresh', key, { ...opts });
        await Promise.all(deps().map(key => dispatch(`${key}Refresh`, opts)))
    }
};
