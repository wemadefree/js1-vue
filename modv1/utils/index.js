import { isFunction } from '@olibm/js1'

const installers = [
    require('./bindPaginateQS').default,
    require('./bindQS').default,
    require('./js1').default,
    require('./misc').default,
    require('./patchRoute').default,
];

const sym = Symbol('$js1');
export function installVueUtils(Vue) {
    if (Vue.$js1 || Vue.prototype.$js1) {
        throw new Error('$js1 commons cannot be initialized twice');
    }

    const utils = [];
    installers.forEach(fn => {
        if (!isFunction(fn)) {
            throw new Error('util default export must be function');
        }
        let u = fn();
        if (!Array.isArray(u)) {
            throw new Error('util installer must return array');
        }
        utils.push(...u)
    })

    utils.forEach(util => {
        if (!util || !isFunction(util.function)) {
            throw new Error('util.function is required');
        }
        if (!util.name || typeof util.name !== 'string') {
            throw new Error('util.name must be valid function name');
        }
    })

    // These functions do not need to access this (the component)
    const withoutBind = {};
    utils.filter(u => !u.bind).forEach(u => withoutBind[u.name] = u.function);

    // These functions need to access this (the component)
    const withBind = {};
    utils.filter(u => u.bind).forEach(u => withBind[u.name] = u.function);

    Vue.$js1 = { ...withoutBind };

    // Preserve 'this' from Vue. Feels a bit hacky but it works.
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
