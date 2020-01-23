import { sortBy, defaultsDeep, isFunction, firstDuplicateBy, flattenBy, ulidlc } from '@olibm/js1'

export default class Js1VueModulesIndexV1 {
    constructor({ requireModule, modules, externalModules, routes, storeModules, leftMenuItems, bootFunctions, i18n, defaultMenuOrder, defaultRouteComponent }) {
        this.requireModule = requireModule;
        this.modules = (modules || []).map(m => typeof m === 'string' ? { key: m } : m);
        this.externalModules = externalModules || [];
        this.routes = routes || [];
        this.storeModules = storeModules || {};
        this.leftMenuItems = leftMenuItems || [];
        this.bootFunctions = bootFunctions || [];
        this.i18n = i18n || {};
        this.moduleIdRegex = /^[a-z0-9-]+$/;
        this.defaultMenuOrder = defaultMenuOrder || 'x-99';
        this.defaultRouteComponent = defaultRouteComponent;

        this.init = this.init.bind(this);
    }

    init() {
        // Load modules from key using the provided requireModule() function
        for (let m of this.modules) {
            if (!m.module) {
                if (!isFunction(this.requireModule)) {
                    throw new Error(`requireModule must be a non-async function that returns the module from key. Example: key => require('./' + key)`)
                }

                m.module = this.requireModule(m.key, m);

                if (!m.module) {
                    throw new Error('requireModule must return a module');
                }

                if (isFunction(m.module.then)) {
                    throw new Error(`Promise detected. requireModule must be a non-async function that returns the module from key. Example: key => require('./' + key)`)
                }

                if (typeof m.module.moduleId === 'undefined') {
                    m.module.moduleId = m.key;
                }
            }
        }

        // Load external modules
        for (let ext of this.externalModules) {
            let extModules = ext && Array.isArray(ext.externalModules) ? ext.externalModules : [ext];
            for (let module of extModules) {
                if (!module || typeof module !== 'object' || module.then) {
                    throw new Error(`invalid external module`);
                }
                if (!module.moduleId) {
                    console.warn('mod', module)
                    throw new Error(`externalModules must export a moduleId`);
                }
                this.modules.push({
                    module
                });
            }
        }

        // Validate modules
        for (let { module } of this.modules) {
            if (!module || typeof module !== 'object' || module.then) {
                throw new Error(`invalid module`);
            }

            if (!module.moduleId || !this.moduleIdRegex.test(module.moduleId)) {
                throw new Error(`Invalid moduleId '${module.moduleId}'. Must match ${this.moduleIdRegex.toString()}`);
            }

            if (typeof module.default !== 'undefined' && !isFunction(module.default)) {
                throw new Error(`The default export from a module must be either undefined or a function. Module: ${module.moduleId}`);
            }
        }

        let duplicateMod = firstDuplicateBy(this.modules, x => x.module.moduleId);
        if (duplicateMod) {
            throw new Error(`Duplicate moduleId ${duplicateMod.module.moduleId}`);
        }

        // Synchronous stuff that is required before booting
        for (let { module } of this.modules) {
            if (module.store) {
                if (typeof module.store.namespaced === 'undefined') {
                    module.store.namespaced = true;
                }
                module.store.js1ns = module.store.namespaced ? module.moduleId : '';
                this.storeModules[module.moduleId] = module.store;
            }
            if (module.i18n) {
                defaultsDeep(this.i18n, module.i18n);
            }
        }


        // Queue stuff to do before module boot functions
        this.bootFunctions.push(context => {
            for (let { module } of this.modules) {
                if (module.store) {
                    context.store.registerModule(module.moduleId, module.store);
                }
            }
        })


        // Queue module boot functions
        this.bootFunctions.push(...this.modules.map(x => x.module.default).filter(x => x));


        // Queue stuff to do after module boot functions
        this.bootFunctions.push(context => {
            for (let { module } of this.modules) {
                // Each module can export routes and menu items
                if (module.routes && module.routes.length) {
                    flattenBy(module.routes, 'children').forEach(r => {
                        if (!r.meta) r.meta = {};
                        if (!r.name && !(r.children && r.children.some(x => x.path === ''))) r.name = ulidlc();

                        if (typeof r.meta.scopes === 'undefined') {
                            r.meta.scopes = ['missing_scope'];
                        }

                        if (typeof r.component === 'undefined') {
                            r.component = this.defaultRouteComponent;
                        }

                        let menu = r.meta.menuLeft;
                        if (menu) {
                            if (!menu.route) {
                                if (!r.name) {
                                    menu.route = r.path;
                                } else {
                                    menu.route = menu.route || { name: r.name };
                                }
                            }
                            this.leftMenuItems.push(menu);
                        }
                    });
                    this.routes.push(...module.routes);
                }
            }
        });

        // Queue final step
        this.bootFunctions.push(context => {
            if (this.routes.length) {
                context.router.addRoutes(this.routes);
            }

            this.leftMenuItems.splice(0, this.leftMenuItems.length, ...sortBy(this.leftMenuItems, x => x.order || this.defaultMenuOrder))
        });

        return this;
    }
}
