import { isFunction } from '../../wraputil.mjs'

// Same as $root.$on / $root.$once except this one will $root.$off when component is destroyed

function _rootListen(type, event, callback) {
    if (!event || typeof event !== 'string') {
        throw new Error('js1: event must be string');
    }
    if (!isFunction(callback)) {
        throw new Error('js1: callback must be function');
    }

    const $root = this.$root;

    const innerCallback = function () {
        return callback.apply(this, arguments);
    };

    $root[type](event, innerCallback);

    this.$once('hook:destroyed', function () {
        $root.$off(event, innerCallback)
    });
}

function onRoot(event, callback) {
    return _rootListen.call(this, '$on', ...arguments);
}

function onceRoot(event, callback) {
    return _rootListen.call(this, '$once', ...arguments);
}

export default function () {
    return [
        {
            bind: true,
            name: 'onRoot',
            function: onRoot,
        },
        {
            bind: true,
            name: 'onceRoot',
            function: onceRoot,
        },
    ]
}
