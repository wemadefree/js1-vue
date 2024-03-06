import { isFunction } from '../../wraputil.mjs'
import bindPaginateQSInstaller from './bindPaginateQS.js'
import bindQSInstaller from './bindQS.js'
import js1Installer from './js1.js'
import miscInstaller from './misc.js'
import onRootInstaller from './onRoot.js'
import patchRouteInstaller from './patchRoute.js'

const installers = [
    bindPaginateQSInstaller,
    bindQSInstaller,
    js1Installer,
    miscInstaller,
    onRootInstaller,
    patchRouteInstaller,
];

function getVueVersion(app, Vue) {
    const ver = (app && app.version) || (Vue && Vue.version) || '';
    if (!ver || typeof ver !== 'string') throw new Error('getVueVersion error');
    return {
        vueVersion: ver,
        vueMajor: Number(ver.split('.')[0]),
    }
}

const sym = Symbol('$js1');
export function installVueUtils(app, Vue) {
    const { vueMajor } = getVueVersion(app, Vue);

    if (Vue && (Vue.$js1 || Vue.prototype.$js1)) {
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

    if (vueMajor >= 3) {
        // TODO: add withBind helpers if globalProperties supports 'this' context
        app.config.globalProperties.$js1 = Object.assign(app.config.globalProperties.$js1 || {}, {
            ...withoutBind,
        });
    }
    else {
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
}
