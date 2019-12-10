import { defaultsDeep } from '@olibm/js1'



export default function () {
    const paginateOriginalDefaults = {
        sortBy: null,
        descending: false,
        page: 1,
        rowsPerPage: 25,
    };
    let paginateDefaults = { ...paginateOriginalDefaults };

    function bindPaginateQS(queryPrefix, defaultValue, { modelPrefix } = {}) {
        defaultValue = defaultsDeep(defaultValue || {}, paginateDefaults);
        if (typeof arguments[2] === 'string') {
            modelPrefix = arguments[2];
        }
        modelPrefix = modelPrefix || queryPrefix;

        for (let key of Object.getOwnPropertyNames(defaultValue)) {
            this.$js1.bindQS(`${queryPrefix}.${key}`, defaultValue[key], {
                modelName: `${modelPrefix}.${key}`,
                patchMode: key === 'page' ? 'push' : 'replace',
                nullQueryValue: 'null',
            });
        }
    }

    return [
        {
            name: 'setPaginateDefaults',
            function(defaults) {
                return paginateDefaults = defaultsDeep({}, defaults, paginateOriginalDefaults);
            }
        },
        {
            bind: true,
            name: bindPaginateQS.name,
            function: bindPaginateQS,
        }
    ]
}
