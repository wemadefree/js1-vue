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
        patchRoute(changes) {
            let r = {};
            if (changes.path) r.path = path;
            if (changes.query) r.query = { ...this.$route.query, ...changes.query };
            if (changes.params) r.params = { ...this.$route.params, ...changes.params };
            this.$router.push(r);
        },
        bindQS(queryName, defaultValue = '', { modelName, canPatchRoute, converter, toQueryConverter } = {}) {
            if (typeof arguments[2] === 'string') {
                modelName = arguments[2];
            }
            if (!converter) {
                switch (typeof defaultValue) {
                    case 'number':
                        converter = Number;
                        break;
                    case 'boolean':
                        converter = Boolean;
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
            setPath(this, modelName, converter(this.$route.query[queryName] || defaultValue));
            this.$watch(modelName, val => {
                if (!canPatchRoute || canPatchRoute()) {
                    this.$js1.patchRoute({ query: { [queryName]: toQueryConverter(val) } })
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

            for (let key in defaultValue) {
                this.$js1.bindQS(`${queryPrefix}.${key}`, defaultValue[key], `${modelPrefix}.${key}`);
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
