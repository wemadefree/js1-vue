import { installVueUtils } from './utils'
import js1VuexModule from './Js1VuexModule'

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

        installVueUtils(Vue);

        context.Modules = Modules;
        for (let fn of this.Modules.bootFunctions) {
            await fn(context);
        }
        store.commit('js1/internalInit', { Modules })
    }
}
