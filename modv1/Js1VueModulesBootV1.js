import { installVueUtils } from './utils/index.js'
import js1VuexModule from './Js1VuexModule.js'

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
        const { Modules } = this;

        store.registerModule('js1', js1VuexModule);

        installVueUtils(app, Vue);

        if (app.i18n && Modules.i18n) {
            const keys = Object.keys(Modules.i18n);
            if (keys.length && !app.i18n || !app.i18n.mergeLocaleMessage) {
                console.warn('app.i18n.mergeLocaleMessage is missing. Did you forget app.use(i18n) ?');
            }
            else {
                for (let key of keys) {
                    app.i18n.mergeLocaleMessage(key, Modules.i18n[key]);
                }
            }
        }

        context.Modules = Modules;
        for (let fn of this.Modules.bootFunctions) {
            await fn(context);
        }
        store.commit('js1/internalInit', { Modules })
    }
}
