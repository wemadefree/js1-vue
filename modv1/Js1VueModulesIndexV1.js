import { sortBy, defaultsDeep, isFunction } from '@olibm/js1'

export default class Js1VueModulesIndexV1 {
    constructor({ requireModule, modules, routes, storeModules, leftMenuItems, bootFunctions, i18n }) {
        this.requireModule = requireModule;
        this.modules = (modules || []).map(m => typeof m === 'string' ? { key: m } : m);
        this.routes = routes || [];
        this.storeModules = storeModules || {};
        this.leftMenuItems = leftMenuItems || [];
        this.bootFunctions = bootFunctions || [];
        this.i18n = i18n || {};
        this.moduleKeyRegex = /^[a-z0-9-]+$/;

        this.init = this.init.bind(this);
    }

    init() {
        const mods = [];

        if (!isFunction(this.requireModule)) {
            throw new Error(`requireModule must be a non-async function that returns the required module by key. Example: key => require('./' + key)`)
        }

        // Load (require) each module
        for (let m of this.modules) {
            if (!this.moduleKeyRegex.test(m.key)) {
                throw new Error(`Invalid characters in module key '${m.key}'. Must match ${this.moduleKeyRegex.toString()}`);
            }

            const mod = this.requireModule(m.key, m);

            if (isFunction(mod.then)) {
                throw new Error(`Promise detected. requireModule must be a non-async function that returns the required module by key. Example: key => require('./' + key)`)
            }

            mods.push({ mod, m });
        }

        // Synchronous stuff that is required before booting
        for (let { mod, m } of mods) {
            if (mod.store) {
                if (typeof mod.store.namespaced === 'undefined') {
                    mod.store.namespaced = true;
                }
                this.storeModules[m.key] = mod.store;
            }
            if (mod.i18n) {
                defaultsDeep(this.i18n, mod.i18n);
            }
        }


        // Queue stuff to do before module boot functions
        this.bootFunctions.push(context => {
            for (let { mod, m } of mods) {
                if (mod.store) {
                    context.store.registerModule(m.key, mod.store);
                }
            }
        })


        // Queue module boot functions
        this.bootFunctions.push(...mods.map(x => x.mod.default).filter(x => x));


        // Queue stuff to do after module boot functions
        this.bootFunctions.push(context => {
            for (let { mod, m } of mods) {
                // Each module can export routes and menu items
                if (mod.routes && mod.routes.length) {
                    mod.routes.forEach(r => {
                        if (!r.meta) r.meta = {};

                        if (typeof r.meta.scopes === 'undefined') {
                            r.meta.scopes = ['missing_scope'];
                        }

                        if (!r.component) {
                            r.component = () => import('layouts/MyLayout.vue');
                        }

                        let menu = r.meta.menuLeft;
                        if (menu) {
                            menu.route = menu.route || r.path;
                            this.leftMenuItems.push(menu);
                        }
                    })
                    this.routes.push(...mod.routes);
                }
            }
        });

        // Queue final step
        this.bootFunctions.push(context => {
            if (this.routes.length) {
                context.router.addRoutes(this.routes);
            }

            this.leftMenuItems.splice(0, this.leftMenuItems.length, ...sortBy(this.leftMenuItems, x => x.order || 'x-99'))
        });

        return this;
    }
}
