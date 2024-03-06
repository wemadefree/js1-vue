import { fixFirebaseData, mapFirebaseData } from './utils.js'
import { jsonClone, ulidlc } from '../../wraputil.mjs'

/*
Extending the class in a webpack project may cause this error:
  Class constructor cannot be invoked without 'new'

# Workaround A:
import { FirestoreCollectionHandlerES5 } from '@we-made/js1-vue/firestore/v1'
export class FirestoreCollectionHandler extends FirestoreCollectionHandlerES5 { constructor() { super(...arguments) } }

# Workaround B:
import { FirestoreCollectionHandler as FCH } from '@we-made/js1-vue/firestore/v1'
export class FirestoreCollectionHandler {
    constructor() {
        let workaround = new FCH(...arguments);
        Object.assign(this, workaround);
        Object.setPrototypeOf(this, FCH.prototype);
    }
}
*/

export class FirestoreCollectionHandler {
    constructor({ key, collectionId, noTenantScope, useUserScope, softDelete, firestoreClient }, { tenantId, userId }) {
        let db = this.db = firestoreClient;
        this.bindOpts = arguments[0];
        this.user = arguments[1];
        collectionId = collectionId || key;
        if (noTenantScope && !useUserScope) {
            this.colRef = db.collection(collectionId);
        }
        else {
            if (!tenantId || typeof tenantId !== 'string') {
                throw new Error('tenantId must be non-empty string');
            }
            if (!userId || typeof userId !== 'string') {
                throw new Error('userId must be non-empty string');
            }

            let colRef;
            if (!noTenantScope) {
                colRef = db.collection('tenants_data').doc(tenantId);
            }
            if (useUserScope) {
                colRef = (colRef || db).collection('user').doc(userId);
            }
            this.colRef = colRef.collection(collectionId);
        }
    }

    prepareListQuery() {
        let query = this.colRef;
        if (this.bindOpts.softDelete) {
            query = query.where('deleted', '==', 0);
        }
        return query;
    }

    requireId(id) {
        if (!id || typeof id !== 'string' || id.includes('/')) {
            throw new Error('id must be a valid non-empty string');
        }
    }

    async listAll(queryParams) {
        queryParams = queryParams || {};
        queryParams.limit = queryParams.limit || 10000;
        let query = this.prepareListQuery().limit(queryParams.limit);
        if (process.env.DEV === true) console.log('listRef', this.colRef.path);
        return await query.get().then(mapFirebaseData);
    }

    async list({ offset, limit } = {}) {
        let query = this.prepareListQuery().offset(offset || 0).limit(limit || 100);
        if (process.env.DEV === true) console.log('listRef', this.colRef.path);
        return await query.get().then(mapFirebaseData);
    }

    async get(id) {
        this.requireId(id);
        let ref = this.colRef.doc(id);
        if (process.env.DEV === true) console.log('getRef', ref.path);
        let snap = await ref.get();
        if (!snap.exists) {
            let err = new Error(`Document not found: ${ref.path}`);
            err.statusCode = 404;
            throw err;
        }
        return fixFirebaseData(snap);
    }

    async create(data) {
        data = jsonClone(data);
        if (!data.id) {
            data.id = ulidlc();
        }
        if (!this.bindOpts.noTenantScope) {
            if (data.tenantId && data.tenantId !== this.user.tenantId) {
                throw new Error('tenantId mismatch in FirestoreCollectionHandler.create');
            }
            data.tenantId = this.user.tenantId;
        }
        this.requireId(data.id);
        let ref = this.colRef.doc(data.id);
        if (process.env.DEV === true) console.log('createRef', ref.path, data);
        if ((await ref.get({ source: 'server' })).exists) {
            let err = new Error(`Document already exists: ${ref.path}`);
            err.statusCode = 409;
            throw err;
        }
        await ref.set(data)
        return data;
    }

    async patch(id, data) {
        this.requireId(id);
        data = jsonClone(data);
        if (data.id && data.id !== id) {
            throw new Error('id mismatch in FirestoreCollectionHandler.update');
        }
        if (!this.bindOpts.noTenantScope) {
            if (data.tenantId && data.tenantId !== this.user.tenantId) {
                throw new Error('tenantId mismatch in FirestoreCollectionHandler.update');
            }
        }
        let ref = this.colRef.doc(id);
        if (process.env.DEV === true) console.log('patchRef', ref.path, data);
        await ref.update(data);
    }

    async delete(id) {
        this.requireId(id);
        let ref = this.colRef.doc(id);
        if (process.env.DEV === true) console.log('deleteRef', ref.path);
        await ref.delete();
    }
}

export function FirestoreCollectionHandlerES5(bindOpts, user) {
    let workaround = new FirestoreCollectionHandler(...arguments);
    Object.assign(this, workaround);
    Object.setPrototypeOf(this, FirestoreCollectionHandler.prototype);
}
