# js1 q-vue modules

## src/boot/modules.js

```js
import Modules from '../modules'
import { Js1VueModulesBoot } from '@olibm/js1-vue/modv1'

export default new Js1VueModulesBoot({
    Modules
}).init();
```

## src/modules/index.js

```js
import { Js1VueModulesIndex } from '@olibm/js1-vue/modv1'

export default new Js1VueModulesIndex({
    requireModule: key => require('./' + key),
    // Define your modules here
    modules: [
        'your-module-a',
        'your-module-b',
    ],
    // Define modules from packages.json here
    externalModules: [],
}).init();
```

## boot/i18n.js

```js
import Vue from 'vue'
import VueI18n from 'vue-i18n'
import messages from 'src/i18n'
import Modules from '../modules'
import { Js1VueModulesI18n } from '@olibm/js1-vue/modv1'
import { LocalStorage } from 'quasar'

Vue.use(VueI18n)

export const i18n = new Js1VueModulesI18n({
  Modules,
  locale: LocalStorage.getItem('locale'),
}).createVueI18n({ messages });

export default ({ app }) => {
  app.i18n = i18n
}
```
