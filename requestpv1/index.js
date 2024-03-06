'use strict'

const { defaultsDeep } = require('@olibm/js1');
const axios = require('axios');

function cloneOptions(options) {
    options = { ...options };
    if (options.qs) options.qs = { ...options.qs };
    if (options.headers) options.headers = { ...options.headers };
    return options;
}

function prepareOptions(options, defaultOptions) {
    options = defaultsDeep(cloneOptions(options || {}), cloneOptions(defaultOptions || {}), {
        method: 'GET',
        url: null,
        qs: {},
        headers: {},
        auth: {},
        baseUrl: null,
        simple: true,
        resolveWithFullResponse: false,
        transform2xxOnly: true,
        json: true,
        debug: false,
        debugResponse: false,
        responseType: 'json',
    });
    if (!options.qs) options.qs = {};
    if (!options.headers) options.headers = {};
    if (!options.auth) options.auth = {};
    return options;
}

class RestClient {
    constructor(options) {
        this._preHooks = [];
        this._responseHooks = [];
        this.configure(options);
    }

    configure(options) {
        this.options = prepareOptions(options, this.options);
        return this;
    }

    preHook(handler) {
        this._preHooks.push(handler);
    }

    responseHook(handler) {
        this._responseHooks.push(handler);
    }

    cancelToken() {
        return axios.CancelToken.source();
    }

    async request(options) {
        const begin = Date.now();

        options = prepareOptions(options, this.options);

        await callHookListeners(this._preHooks, { type: 'pre', options });

        let axiosOptions = toAxiosOptions(options);

        if (options.debug) console.log('requestp-req', { method: options.method, url: options.url, options, axiosOptions });

        if (options.json !== true) {
            throw new Error('json=false is not implemented yet');
        }

        let wasHookError = false;
        try {
            let axiosResp = await axios(axiosOptions);
            let resp = transformAxiosResp(axiosResp, options);
            await callHookListeners(this._responseHooks, { hook: 'response', options, response: resp }).catch(err => {
                wasHookError = true;
                throw err;
            });
            const stook = Number(axiosResp.headers['debug-took'] || '-1');
            if (options.debug || options.debugResponse) {
                console.groupCollapsed('requestp-res', { method: options.method, url: options.url, took: Date.now() - begin, stook, resp, axiosResp, options, axiosOptions });
                console.log(resp);
                console.trace();
                console.groupEnd();
            }
            return resp;
        }
        catch (err) {
            if (axios.isCancel(err)) {
                let terr = new RestClientError('API request cancelled');
                terr.isCancel = true;
                throw terr;
            }
            if (options.debug || options.debugResponse) console.warn('requestp-res', { method: options.method, url: options.url, took: Date.now() - begin, err, options, axiosOptions });
            if (wasHookError) {
                throw err;
            }
            if (err.isAxiosError) {
                if (err.response) {
                    let resp = transformAxiosResp(err.response, options);
                    await callHookListeners(this._responseHooks, { hook: 'response', options, response: resp });
                    return resp
                }
                else if (err.request) {
                    throw new RestClientError(`API request error: ${err.message}`);
                }
            }
            console.error('Unexpected API client error', err);
            throw new RestClientError(`Unexpected API error: ${err.message}`);
        }
    }

    make() {
        let request = this.request.bind(this);
        request.get = requestMethodFn.bind({ method: 'GET', request });
        request.put = requestMethodFn.bind({ method: 'PUT', request });
        request.post = requestMethodFn.bind({ method: 'POST', request });
        request.patch = requestMethodFn.bind({ method: 'PATCH', request });
        request.delete = requestMethodFn.bind({ method: 'DELETE', request });
        request.cancelToken = this.cancelToken.bind(this);
        return request;
    }
}

async function requestMethodFn(url, options) {
    return await this.request({
        ...options || {},
        method: this.method,
        url,
    });
}

async function callHookListeners(listeners, ev) {
    if (Array.isArray(listeners)) {
        for (let l of listeners) {
            await l.call(null, ev);
        }
    }
}

class RestClientError extends Error {
    constructor(message) {
        super(message);
    }
}

class RestClientHttpError extends RestClientError {
    constructor(message, response) {
        super(message);
        this.isHttpError = true;
        this.response = response;
        this.status = response.statusCode;
        this.statusCode = response.statusCode;
        this.responseBody = response.body;
        this.error = response.body;
        this.errorType = response.body && response.body.type || 'unknown';
        this.errorTitle = response.body && response.body.title || '';
        this.errorDetail = response.body && response.body.detail || '';
        this.errorMessage = this.errorTitle || this.errorDetail || this.errorType || (response.body && response.body.message) || message;
    }
}

function transformAxiosResp(axiosResp, options) {
    let resp = fromAxiosRespToFull(axiosResp);;
    if (options.simple && !resp.statusCodeSuccess) {
        throw new RestClientHttpError(`API call failed with status code ${resp.statusCode}`, resp);
    }
    if (options.resolveWithFullResponse || (!resp.statusCodeSuccess && options.transform2xxOnly)) {
        return resp;
    } else {
        return resp.body;
    }
}

function fromAxiosRespToFull(axiosResp) {
    return {
        statusCode: axiosResp.status,
        statusCodeSuccess: !!(axiosResp.status >= 200 && axiosResp.status < 300),
        body: axiosResp.data,
        headers: axiosResp.headers,
    };
}

function toAxiosOptions(options) {
    let axiosOptions = {
        method: options.method.toLowerCase(),
        url: options.url,
        baseURL: options.baseUrl,
        headers: options.headers,
        params: options.qs,
        data: options.body,
        cancelToken: options.cancelToken,
        responseType: options.responseType,
    };

    if (options.auth.bearer) {
        axiosOptions.headers['authorization'] = `Bearer ${options.auth.bearer}`;
    }
    else if (options.auth.user || options.auth.username || options.auth.pass || options.auth.password) {
        axiosOptions.auth = {
            username: options.auth.user || options.auth.username,
            password: options.auth.pass || options.auth.password,
        };
    }
    return axiosOptions;
}

exports.RestClientError = RestClientError;
exports.RestClientHttpError = RestClientHttpError;
exports.RestClient = RestClient;
