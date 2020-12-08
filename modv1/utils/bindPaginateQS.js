import { defaultsDeep, cloneDeep } from '@olibm/js1'



export default function () {
    const paginateOriginalDefaults = {
        sortBy: null,
        descending: false,
        page: 1,
        rowsPerPage: 25,
    };
    let paginateDefaults = { ...paginateOriginalDefaults };

    // NB! paginateDefaults is applied to the original defaultValue
    function bindPaginateQS(queryPrefix, defaultValue, { modelPrefix } = {}) {
        defaultValue = cloneDeep(defaultsDeep(defaultValue || {}, cloneDeep(paginateDefaults)));
        if (typeof arguments[2] === 'string') {
            modelPrefix = arguments[2];
        }
        modelPrefix = modelPrefix || queryPrefix;

        Object.keys(defaultValue).forEach(key => {
            this.$js1.bindQS(`${queryPrefix}.${key}`, defaultValue[key], {
                modelName: `${modelPrefix}.${key}`,
                patchMode: key === 'page' ? 'push' : 'replace',
                nullQueryValue: 'null',
            });
        });
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
            name: 'bindPaginateQS',
            function: bindPaginateQS,
        }
    ]
}
