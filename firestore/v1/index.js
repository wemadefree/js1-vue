import { ulidlc, uniq, sortBy as lodashSortBy } from '@olibm/js1'
import { FirestoreCollectionHandler } from './FirestoreCollectionHandler'
import { RestCollectionHandler } from './RestCollectionHandler'

export * from './utils'
export * from './FirestoreCollectionHandler'
export * from './RestCollectionHandler'

let firebase = null;
let defaultFirestore = null;

export function setFirebase(fb) {
    firebase = fb;
    defaultFirestore = fb.firestore();
}

function defaultSortBy(row) {
    return (row.name || row.id).toLowerCase();
}

export const idChangedTriggers = [];
export function bindCollection(s, key, { noTenantScope, useUserScope, softDelete, sortBy, join, collectionHandlerFactory, noCreatedAt, noUpdatedAt, noCreatedBy, noUpdatedBy, restClient, restBaseUrl, firestoreClient, collectionId, noRefreshOnTenantIdChange, noRefreshOnUserIdChange } = {}) {
    if (typeof key == 'object') {
        key = key.key;
    }

    noRefreshOnTenantIdChange = !!noRefreshOnTenantIdChange;
    noRefreshOnUserIdChange = !!noRefreshOnUserIdChange;
    collectionId = collectionId || key;
    firestoreClient = firestoreClient || defaultFirestore;
    join = join || [];
    sortBy = sortBy || defaultSortBy;
    if (typeof sortBy === 'string') {
        const kn = sortBy;
        sortBy = x => x[kn];
    }

    let bindOpts = {
        ...(arguments[2] || {}),
        join,
        sortBy,
        key,
        collectionId,
        firestoreClient,
    };

    if (!collectionHandlerFactory) {
        if (restClient) {
            collectionHandlerFactory = function (bindOpts, user) {
                return new RestCollectionHandler(bindOpts, user);
            }
        } else {
            collectionHandlerFactory = function (bindOpts, user) {
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
    s.state[`${key}Refreshed`] = false;

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

    s.mutations[`${key}Refresh`] = function (state, items) {
        let map = {};
        for (let item of items) {
            validateItem(item);
            map[item.id] = item;
        }
        state[key] = map;
        state[`${key}Refreshed`] = true;
    };

    s.mutations[`${key}Reset`] = function (state) {
        state[key] = {};
        state[`${key}Refreshed`] = false;
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
        if (typeof opts === 'boolean') {
            opts = { blockOnce: opts };
        }
        opts = opts || {};

        const refreshed = cx.state[`${key}Refreshed`];

        if (opts.once && refreshed) {
            return;
        }

        const prom = colHandler.listAll().then(rows => {
            if (opts.reset) {
                cx.commit(`${key}Reset`);
            }
            cx.commit(`${key}Refresh`, rows);
        });

        if (refreshed && opts.blockOnce) {
            prom.catch(err => {
                console.warn(`${key}Refresh failed but no error is thrown due to blockOnce`, err);
            });
        }
        else {
            await prom;
        }
    };

    s.actions[`${key}Create`] = async function (cx, item) {
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
    };

    s.actions[`${key}Update`] = async function (cx, item) {
        if (!noUpdatedAt) {
            item.updatedAt = new Date().toISOString();
        }
        if (!noUpdatedBy) {
            item.updatedBy = currentUserId;
        }
        await colHandler.patch(item.id, item);
        item = await colHandler.get(item.id);
        cx.commit(`${key}Set`, item);
        return item;
    };

    s.actions[`${key}Delete`] = async function (cx, id) {
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

    store.getters[expanderKey] = expander;

    store.getters[refreshedKey] = (_, getters) => {
        return deps().every(dep => getters[`${dep}Refreshed`]);
    };

    store.getters[loadingKey] = (_, getters) => !getters[refreshedKey]

    store.getters[key] = (_, getters) => {
        let expander = getters[expanderKey];
        return getters[collectionId].map(x => expander(x.id));
    };

    store.actions[`${key}Refresh`] = async ({ dispatch }, opts) => {
        await Promise.all(deps().map(key => dispatch(`${key}Refresh`, opts)))
    }
};
