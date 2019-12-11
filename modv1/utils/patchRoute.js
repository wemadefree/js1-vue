
function patchRoute(changes, mode = 'push') {
    let r = {};
    if (changes.path) r.path = path;
    if (changes.query) r.query = { ...this.$route.query, ...changes.query };
    if (changes.params) r.params = { ...this.$route.params, ...changes.params };
    this.$router[mode](r);
}

export default function () {
    return [
        {
            bind: true,
            name: 'patchRoute',
            function: patchRoute,
        }
    ]
}
