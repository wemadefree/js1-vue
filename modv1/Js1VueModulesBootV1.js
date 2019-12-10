import { installVueUtils } from './utils'

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

        installVueUtils(Vue);

        context.Modules = this.Modules;
        for (let fn of this.Modules.bootFunctions) {
            await fn(context);
        }
    }
}
