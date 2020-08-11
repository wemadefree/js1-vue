# js1 q-vue modules

## src/boot/modules.js

```js
import Modules from '../modules'
import { Js1VueModulesBoot } from '@olibm/js1-vue/modv1'

const booter = new Js1VueModulesBoot({
  Modules,
}).init();

export default async function ({ }) {
  await booter.apply(this, arguments)
}
```

## src/modules/index.js

```js
import { Js1VueModulesIndex } from '@olibm/js1-vue/modv1'

export default new Js1VueModulesIndex({
    requireModule: key => require('./' + key + '/index'),
    defaultRouteComponent: () => import('layouts/MyLayout.vue'),
    storeIdCamelCase: true,
    // Define your modules here
    modules: [
        'your-module-a',
        'your-module-b',
    ],
    // Define modules from packages.json here
    externalModules: [],
}).init();
```
