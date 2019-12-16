import { getPath, setPath } from '@olibm/js1'

function bindQS(queryName, defaultValue = '', { modelName, canPatchRoute, converter, toQueryConverter, patchMode, nullQueryValue } = {}) {
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
    setPath(this, modelName, converter(this.$route.query[queryName] || defaultValue));
    this.$watch(modelName, val => {
        if (!canPatchRoute || canPatchRoute()) {
            let qval = toQueryConverter(val);
            if (this.$route.query[queryName] === qval) {
                return;
            }
            if (typeof this.$route.query[queryName] === 'undefined' && qval === toQueryConverter(defaultValue)) {
                return;
            }
            this.$js1.patchRoute({ query: { [queryName]: qval } }, patchMode);
        }
    });
    this.$watch(`$route.query.${queryName}`, val => {
        setPath(this, modelName, converter(val || defaultValue))
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
