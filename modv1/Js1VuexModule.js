export default {
    namespaced: true,
    state: {
        modules: {},
        menuItems: {},
        defaultMenuSection: '',
    },
    getters: {
        modules: state => Object.values(state.modules),
        menuItems: state => Object.values(state.menuItems).js1SortBy(x => x.order),
        defaultMenuItems: (state, getters) => getters.menuItems.filter(x => x.section === state.defaultMenuSection),
        menuItemsBySection(state, getters) {
            let o = {};
            for (let menu of getters.menuItems) {
                if (!o[menu.section]) {
                    o[menu.section] = [];
                }
                o[menu.section].push(menu);
            }
            return o;
        },
        getMenuItems(state, getters) {
            return (section, { userScopes } = {}) => {
                return getters.menuItems.filter(x => {
                    if (x.section !== section) {
                        return false;
                    }
                    if (x.scopes && x.scopes.length) {
                        if (!userScopes) {
                            return false;
                        }
                        return x.scopes.some(s => userScopes.includes(s));
                    }
                    return true;
                })
            }
        },
    },
    mutations: {
        internalInit(state, { Modules }) {
            if (process.env.DEV) console.log('js1/internalInit', { Modules });
            state.defaultMenuSection = Modules.defaultMenuSection;
            Modules.modules.forEach(mod => {
                state.modules[mod.module.moduleId] = {
                    key: mod.key,
                    moduleId: mod.module.moduleId,
                }
            });
            Modules.menuItems.forEach(menu => {
                state.menuItems[menu.name] = menu;
            });
        }
    }
};
