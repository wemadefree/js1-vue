import { sortBy, defaultsDeep, isFunction, firstDuplicateBy, flattenBy, ulidlc, forOwn, camelCase } from '@olibm/js1'

export default class Js1VueModulesIndexV1 {
    constructor({ requireModule, modules, externalModules, routes, storeModules, menuItems, bootFunctions, i18n, defaultMenuOrder, defaultRouteComponent, defaultMenuSection, storeIdCamelCase }) {
        this.requireModule = requireModule;
        this.modules = (modules || []).map(m => typeof m === 'string' ? { key: m } : m);
        this.externalModules = externalModules || [];
        this.routes = routes || [];
        this.storeModules = storeModules || {};
        this.menuItems = menuItems || [];
        this.leftMenuItems = []; // deprecated. Use menuItems instead
        this.bootFunctions = bootFunctions || [];
        this.i18n = i18n || {};
        this.moduleIdRegex = /^[a-z0-9-]+$/;
        this.storeIdRegex = /^[a-zA-Z0-9-]+$/;
        this.storeIdCamelCase = !!storeIdCamelCase; // When storeId is set from moduleId it will be camel-cased. Explicitly defined storeIds is left as is.
        this.defaultMenuOrder = defaultMenuOrder || 'x-99';
        this.defaultRouteComponent = defaultRouteComponent;
        this.defaultMenuSection = defaultMenuSection || 'left';

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

                if (!m.module.storeId) {
                    m.module.storeId = m.module.moduleId;
                    if (this.storeIdCamelCase) {
                        m.module.storeId = camelCase(m.module.storeId);
                    }
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
                if (!m.module.storeId) {
                    module.storeId = module.moduleId;
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

            if (!module.storeId || !this.storeIdRegex.test(module.storeId)) {
                throw new Error(`Invalid storeId '${module.storeId}'. Must match ${this.storeIdRegex.toString()}`);
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
                this.storeModules[module.storeId] = module.store;
            }
            if (module.i18n) {
                defaultsDeep(this.i18n, module.i18n);
            }
        }


        // Queue stuff to do before module boot functions
        this.bootFunctions.push(context => {
            for (let { module } of this.modules) {
                if (module.store) {
                    context.store.registerModule(module.storeId, module.store);
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
                        if (!r.name && !(r.children && r.children.some(x => x.path === ''))) r.name = ulidlc().substr(-10);

                        if (typeof r.component === 'undefined') {
                            r.component = this.defaultRouteComponent;
                        }

                        if (r.meta.pageTitle && r.component) {
                            let ocomp = r.component;
                            r.component = async () => {
                                let o = (await ocomp()).default;
                                if (!o.meta) o.meta = {};
                                if (!o.meta.title) o.meta.title = r.meta.pageTitle;
                                return o;
                            };
                        }

                        let menuItems = this.menuItems;

                        if (r.meta.menuLeft) {
                            console.warn('meta.menuLeft is deprecated. Use meta.menu instead');
                            if (r.meta.menu) {
                                throw new Error('meta.menuLeft and meta.menu cannot be defined at the same time');
                            }
                            menuItems = this.leftMenuItems;
                            r.meta.menu = r.meta.menuLeft;
                        }

                        let menu = r.meta.menu;
                        if (menu) {
                            if (!menu.section) {
                                menu.section = this.defaultMenuSection;
                            }
                            if (!menu.route) {
                                menu.route = !r.name ? r.path : { name: r.name };
                            }
                            if (!menu.scopes) {
                                menu.scopes = r.meta.scopes;
                            }
                            if (!menu.order) {
                                menu.order = this.defaultMenuOrder;
                            }

                            if (!menu.name) {
                                menu.name = menuAutoNameHelper(menu.route, menu.section, menuItems);
                            }
                            let orgMenu = { ...menu };
                            menuItems.push(orgMenu);

                            if (r.meta.menuSections) {
                                forOwn(r.meta.menuSections, (menuOverrides, section) => {
                                    if (menu.section === section) {
                                        Object.assign(orgMenu, menuOverrides);
                                    } else {
                                        let name = menuOverrides.name || menuAutoNameHelper(menuOverrides.route || menu.route, section, menuItems);
                                        let menuSection = Object.assign({}, menu, menuOverrides, {
                                            name,
                                            section,
                                        });
                                        menuItems.push(menuSection)
                                    }
                                });
                            }
                        }
                        else if (Object.keys(r.meta.menuSections || {}).length) {
                            throw new Error('meta.menu is required when menuSections is defined');
                        }
                    });
                    this.routes.push(...module.routes);
                }
            }

            let duplicateMenuName = firstDuplicateBy(this.menuItems, x => x.name);
            if (duplicateMenuName) {
                throw new Error(`Duplicate menu name: ${duplicateMenuName.name}`);
            }
        });

        // Queue final step
        this.bootFunctions.push(context => {
            if (this.routes.length) {
                context.router.addRoutes(this.routes);
            }

            this.leftMenuItems.splice(0, this.leftMenuItems.length, ...sortBy(this.leftMenuItems, x => x.order))
            this.menuItems.splice(0, this.menuItems.length, ...sortBy(this.menuItems.filter(x => !x.ignore), x => x.order))
        });

        return this;
    }
}

function menuAutoNameHelper(route, section, menuItems) {
    if (route.name) {
        let autoName = `${route.name}-${section}`;
        while (menuItems.find(x => x.name === autoName)) {
            autoName = `${route.name}-${section}-${ulidlc().substr(-10)}`;
        }
        return autoName;
    }
    return ulidlc().substr(-10);
}
