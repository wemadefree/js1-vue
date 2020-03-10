import { jsonClone } from '@olibm/js1'

export class RestCollectionHandler {
    constructor({ collectionId, noTenantScope, restBaseUrl, restClient }, { tenantId, userId }) {

        this.restClient = restClient; // Instance of npm request-promise or similar
        this.bindOpts = arguments[0];
        this.user = arguments[1];

        if (this.bindOpts.useUserScope) {
            throw new Error('useUserScope is not supported in RestCollectionHandler');
        }
        else if (this.bindOpts.softDelete) {
            throw new Error('softDelete is not supported in RestCollectionHandler')
        }
        else if (!collectionId || typeof collectionId !== 'string') {
            throw new Error('collectionId must be non-empty string');
        }

        if (!noTenantScope) {
            if (!tenantId || typeof tenantId !== 'string') {
                throw new Error('tenantId must be non-empty string');
            }
            if (!userId || typeof userId !== 'string') {
                throw new Error('userId must be non-empty string');
            }
        }

        this.baseUrl = (restBaseUrl || '') + (noTenantScope ? `/${collectionId}` : `/tenants/${tenantId}/${collectionId}`);
    }

    requireId(id) {
        if (!id || typeof id !== 'string' || id.includes('/')) {
            throw new Error('id must be a valid non-empty string');
        }
    }

    prepareBaseUrl() {
        return this.baseUrl;
    }

    prepareListRequest({ offset, limit } = {}) {
        return {
            method: 'GET',
            url: this.prepareBaseUrl(),
            qs: { offset, limit },
            json: true,
        };
    }

    prepareCreateRequest(body) {
        return {
            method: 'POST',
            url: this.prepareBaseUrl(),
            body,
            json: true,
        };
    }

    prepareRowRequest(method, id, body) {
        this.requireId(id);
        return {
            method,
            url: this.prepareBaseUrl() + '/' + encodeURIComponent(id),
            body,
            json: true,
        };
    }

    extractListFromResp(resp, request) {
        return resp[this.bindOpts.collectionId];
    }

    extractRowFromResp(resp, request) {
        return resp;
    }

    async listAll() {
        let rows = await this.list({ limit: 1000 });
        if (rows.length >= 1000) {
            // TODO: Implement multiple calls to fetch all rows
            throw new Error('listAll failed to list all rows due to missing implementation');
        }
        return rows;
    }

    async list(opts) {
        let request = this.prepareListRequest(opts);
        if (process.env.DEV) console.log('listRest', request);
        return await this.restClient(request).then(resp => this.extractListFromResp(resp, request));
    }

    async get(id) {
        let request = this.prepareRowRequest('GET', id);
        if (process.env.DEV) console.log('getRest', request);
        return await this.restClient(request).then(resp => this.extractRowFromResp(resp, request));
    }

    async create(data) {
        let request = this.prepareCreateRequest(jsonClone(data));
        if (process.env.DEV === true) console.log('createRest', request);
        return await this.restClient(request).then(resp => this.extractRowFromResp(resp, request));
    }

    async patch(id, data) {
        let request = this.prepareRowRequest('PATCH', id, jsonClone(data));
        if (process.env.DEV === true) console.log('patchRest', request);
        await this.restClient(request);
    }

    async delete(id) {
        let request = this.prepareRowRequest('DELETE', id);
        if (process.env.DEV === true) console.log('deleteRest', request);
        await this.restClient(request).catch(err => {
            if (err.statusCode === 404) {
                return;
            }
            throw err;
        });
    }
}

export function RestCollectionHandlerES5(bindOpts, user) {
    let workaround = new RestCollectionHandler(...arguments);
    Object.assign(this, workaround);
    Object.setPrototypeOf(this, RestCollectionHandler.prototype);
}
