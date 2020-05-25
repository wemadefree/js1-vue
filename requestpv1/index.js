'use strict'

const defaultsDeep = require('lodash.defaultsdeep');
const axios = require('axios');

function cloneOptions(options) {
    options = { ...options };
    if (options.query) options.query = { ...options.query };
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
    });
    if (!options.qs) options.qs = {};
    if (!options.headers) options.headers = {};
    if (!options.auth) options.auth = {};
    return options;
}

class RestClient {
    constructor(options) {
        this.configure(options);
    }

    configure(options) {
        this.options = prepareOptions(options, this.options);
        return this;
    }

    async request(options) {
        options = prepareOptions(options, this.options)
        let axiosOptions = toAxiosOptions(options);

        if (options.debug) console.log('requestp-req', { method: options.method, url: options.url, options, axiosOptions });

        if (options.json !== true) {
            throw new Error('json=false is not implemented yet');
        }

        try {
            let axiosResp = await axios(axiosOptions);
            let resp = transformAxiosResp(axiosResp, options);
            if (options.debug) console.log('requestp-res', { method: options.method, url: options.url, resp, axiosResp, options, axiosOptions });
            return transformAxiosResp(axiosResp, options);
        }
        catch (err) {
            if (options.debug) console.warn('requestp-res', { method: options.method, url: options.url, err, options, axiosOptions });
            if (err.isAxiosError) {
                if (err.response) {
                    return transformAxiosResp(err.response, options);
                }
                else if (err.request) {
                    throw new RestClientError(`API request error: ${err.message}`);
                }
            }
            console.error('Unexpected API client error', err);
            throw new RestClientError(`Unexpected API error: ${err.message}`);
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
