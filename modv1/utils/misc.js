
function rmkeys(o, ...keys) {
    o = Object.assign({}, o);
    keys.forEach(k => delete o[k]);
    return o;
}

function concat(...arrays) {
    return [].concat(...arrays);
}

export default function () {
    return [
        { name: 'rmkeys', function: rmkeys },
        { name: 'concat', function: concat },
        {
            name: 'log',
            function() {
                console.log.apply(console, arguments);
            }
        },
        {
            name: 'warn',
            function() {
                console.warn.apply(console, arguments);
            }
        },
        {
            name: 'error',
            function() {
                console.error.apply(console, arguments);
            }
        },
    ]
}
