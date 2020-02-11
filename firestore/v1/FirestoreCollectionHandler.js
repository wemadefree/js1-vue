import { fixFirebaseData, mapFirebaseData } from './utils'

/*
Workaround for Class constructor cannot be invoked without 'new'

import { FirestoreCollectionHandler as FCH } from '@olibm/js1-vue/firestore/v1'
export class FirestoreCollectionHandler {
    constructor() {
        let workaround = new FCH(...arguments);
        Object.assign(this, workaround);
        Object.setPrototypeOf(this, FCH.prototype);
    }
}
*/

export class FirestoreCollectionHandler {
    constructor(db, { key, noTenantScope, useUserScope, softDelete }, { tenantId, userId }) {
        this.db = db;
        this.bindOpts = arguments[1];
        this.user = arguments[2];
        if (noTenantScope && !useUserScope) {
            this.colRef = db.collection(key);
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
            this.colRef = colRef.collection(key);
        }
    }

    prepareGetAllQuery() {
        let query = this.colRef;
        if (this.bindOpts.softDelete) {
            query = query.where('deleted', '==', 0);
        }
        return query;
    }

    async getAll() {
        let query = this.prepareGetAllQuery();
        return await query.get().then(mapFirebaseData);
    }

    async get(id) {
        let ref = this.colRef.doc(id);
        if (process.env.DEV === true) console.log('getRef', ref.path)
        return await ref.get().then(fixFirebaseData);
    }

    async put(id, data) {
        let ref = this.colRef.doc(id);
        if (process.env.DEV === true) console.log('putRef', ref.path, JSON.parse(JSON.stringify(data)));
        await ref.set(data)
    }

    async patch(id, data) {
        let ref = this.colRef.doc(id);
        if (process.env.DEV === true) console.log('patchRef', ref.path, JSON.parse(JSON.stringify(data)));
        await ref.update(data);
    }

    async deleteHard(id) {
        let ref = this.colRef.doc(id);
        if (process.env.DEV === true) console.log('deleteRef', ref.path);
        await ref.delete();
    }
}
