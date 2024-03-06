import { getPath, setPath } from '../../wraputil.mjs'

function bindQS(queryName, defaultValue = '', { modelName, canPatchRoute, converter, toQueryConverter, patchMode, nullQueryValue, patchDebounce } = {}) {
    if (typeof arguments[2] === 'string') {
        modelName = arguments[2];
    }
    if (!converter) {
        switch (typeof defaultValue) {
            case 'number':
                converter = x => x === nullQueryValue ? null : Number(x);
                break;
            case 'boolean':
                converter = x => !x || x == 0 || x == 'false' ? false : true;
                break;
            default:
                converter = x => x === nullQueryValue ? null : String(x);
                break;
        }
    }
    if (typeof nullQueryValue !== 'undefined' && typeof nullQueryValue !== 'string') {
        throw new Error('nullQueryValue must be string or undefined');
    }
    nullQueryValue = nullQueryValue || ''
    if (!toQueryConverter) {
        toQueryConverter = x => x === null ? nullQueryValue : String(x);
    }
    modelName = modelName || queryName;
    patchMode = patchMode || 'push';
    queryName = queryName.replace(/\./g, '_');
    patchDebounce = Number(patchDebounce || 10);
    setPath(this, modelName, converter(this.$route.query[queryName] || defaultValue));

    this.$watch(modelName, val => {
        if (!canPatchRoute || canPatchRoute()) {
            let qval = toQueryConverter(val);

            // queuePatchRoute (debounce) route changes to support multiple model changes
            queuePatchRoute(this, patchMode, queryName, qval, toQueryConverter(defaultValue), patchDebounce);
        }
    });
    this.$watch(`$route.query.${queryName}`, val => {
        val = converter(val || defaultValue);
        if (getPath(this, modelName) !== val) {
            setPath(this, modelName, val)
        }
    });
}

function bindQSM({ target, paths }) {
    target = target || this;
    if (!Array.isArray(paths) || paths.some(x => !x || typeof x !== 'string')) {
        throw new Error('paths must be array of non-empty strings')
    }
    paths.forEach(path => {
        let queryName = path.replace(/\./g, '_');
        let defaultValue = getPath.call(this, target, path);
        bindQS.call(this, queryName, defaultValue, {
            ...arguments[0] || {},
            modelName: path,
            target: undefined,
            paths: undefined,
        });
    });
}

let patchRouteCx = {
    path: '',
    query: {},
    qdefaults: {},
    patchMode: 'replace',
    timer: 0,
    reset(comp) {
        patchRouteCx.path = comp.$route.path;
        patchRouteCx.query = {};
        patchRouteCx.qdefaults = {};
        patchRouteCx.patchMode = 'replace';
    },
    execute(comp) {
        const { path, query, patchMode } = patchRouteCx;
        patchRouteCx.reset(comp);
        if (path === comp.$route.path) {
            const qpatch = {};

            Object.keys(query).forEach(queryName => {
                const qval = query[queryName];

                if (comp.$route.query[queryName] === qval) {
                    return;
                }
                if (typeof comp.$route.query[queryName] === 'undefined' && qval === patchRouteCx.qdefaults[queryName]) {
                    return;
                }

                qpatch[queryName] = qval;
            });

            if (Object.keys(qpatch).length) {
                comp.$router[patchMode]({
                    query: {
                        ...comp.$route.query,
                        ...qpatch,
                    }
                });
            }
        }
    }
}
function queuePatchRoute(comp, patchMode, queryName, qval, qDefaultVal, patchDebounce) {
    if (patchRouteCx.timer) {
        clearTimeout(patchRouteCx.timer);
    }
    if (patchRouteCx.path !== comp.$route.path) {
        patchRouteCx.reset(comp);
    }

    if (patchRouteCx.patchMode !== 'push') {
        patchRouteCx.patchMode = patchMode;
    }

    patchRouteCx.query[queryName] = qval;
    patchRouteCx.qdefaults[queryName] = qDefaultVal;

    if (Number.isSafeInteger(patchDebounce) && patchDebounce > 0) {
        patchRouteCx.timer = setTimeout(patchRouteCx.execute.bind(null, comp), patchDebounce);
    }
    else {
        patchRouteCx.execute(comp);
    }
};


export default function () {
    return [
        {
            bind: true,
            name: 'bindQS',
            function: bindQS,
        },
        {
            bind: true,
            name: 'bindQSM',
            function: bindQSM,
        }
    ]
}
