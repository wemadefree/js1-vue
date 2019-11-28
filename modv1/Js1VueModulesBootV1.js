import { sortBy, cloneDeep, isEqual, defaultsDeep, getPath, hasPath, setPath, unsetPath } from '@olibm/js1'

export default class Js1VueModulesBootV1 {
    constructor({ Modules }) {
        this.Modules = Modules;
        this.boot = this.boot.bind(this);
    }

    init() {
        return this.boot;
    }

    async boot(context) {
        const { app, router, store, Vue, ssrContext, urlPath, redirect } = context;

        vueProtoCommons(Vue);

        context.Modules = this.Modules;
        for (let fn of this.Modules.bootFunctions) {
            await fn(context);
        }

    }
}

const sym = Symbol('$js1');
function vueProtoCommons(Vue) {
    // These functions do not need to access this (the component)
    const withoutBind = {
        sortBy,
        cloneDeep,
        isEqual,
        defaultsDeep,
        getPath,
        hasPath,
        setPath,
        unsetPath,
        rmkeys(o, ...keys) {
            o = Object.assign({}, o);
            keys.forEach(k => delete o[k]);
            return o;
        },
        concat(...arrays) {
            return [].concat(...arrays);
        },

        log() {
            console.log.apply(console, arguments);
        },
        warn() {
            console.warn.apply(console, arguments);
        },
        error() {
            console.error.apply(console, arguments);
        },
    };

    // These functions need to access this (the component). Feels a bit hacky but it works.
    const withBind = {
        patchRoute(changes, mode = 'push') {
            let r = {};
            if (changes.path) r.path = path;
            if (changes.query) r.query = { ...this.$route.query, ...changes.query };
            if (changes.params) r.params = { ...this.$route.params, ...changes.params };
            this.$router[mode](r);
        },
        bindQS(queryName, defaultValue = '', { modelName, canPatchRoute, converter, toQueryConverter, patchMode } = {}) {
            if (typeof arguments[2] === 'string') {
                modelName = arguments[2];
            }
            if (!converter) {
                switch (typeof defaultValue) {
                    case 'number':
                        converter = Number;
                        break;
                    case 'boolean':
                        converter = x => !x || x == 0 || x == 'false' ? false : true;
                        break;
                    default:
                        converter = String;
                        break;
                }
            }
            if (!toQueryConverter) {
                toQueryConverter = x => x === null ? '' : String(x);
            }
            modelName = modelName || queryName;
            patchMode = patchMode || 'push';
            queryName = queryName.replace(/\./g, '_');
            setPath(this, modelName, converter(this.$route.query[queryName] || defaultValue));
            this.$watch(modelName, val => {
                if (!canPatchRoute || canPatchRoute()) {
                    let qval = toQueryConverter(val);
                    if (this.$route.query[queryName] === qval) {
                        return;
                    }
                    if (typeof this.$route.query[queryName] === 'undefined' && qval === toQueryConverter(defaultValue)) {
                        return;
                    }
                    this.$js1.patchRoute({ query: { [queryName]: qval } }, patchMode);
                }
            });
            this.$watch(`$route.query.${queryName}`, val => setPath(this, modelName, converter(val || defaultValue)));
        },
        bindPaginateQS(queryPrefix, defaultValue, { modelPrefix } = {}) {
            defaultValue = defaultsDeep(defaultValue || {}, {
                sortBy: null,
                descending: false,
                page: 1,
                rowsPerPage: 25,
            });
            if (typeof arguments[2] === 'string') {
                modelPrefix = arguments[2];
            }
            modelPrefix = modelPrefix || queryPrefix;

            for (let key of Object.getOwnPropertyNames(defaultValue)) {
                this.$js1.bindQS(`${queryPrefix}.${key}`, defaultValue[key], {
                    modelName: `${modelPrefix}.${key}`,
                    patchMode: key === 'page' ? 'push' : 'replace',
                });
            }
        }
    };

    if (Vue.prototype.$js1) {
        throw new Error('$js1 commons cannot be initialized twice');
    }

    Object.defineProperty(Vue.prototype, '$js1', {
        get() {
            if (!this[sym]) {
                const o = this[sym] = {
                    ...withoutBind,
                };
                const self = this;
                for (let key in withBind) {
                    o[key] = new Proxy(withBind[key], {
                        apply(target, _, args) {
                            return target.apply(self, args);
                        }
                    })
                }
            }
            return this[sym];
        }
    });
}
