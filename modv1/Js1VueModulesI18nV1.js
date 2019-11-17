import { defaultsDeep } from '@olibm/js1'

export default class Js1VueModulesI18nV1 {
    constructor({ Modules, locale, fallbackLocale }) {
        this.Modules = Modules;
        this.locale = locale || 'en-us';
        this.fallbackLocale = fallbackLocale || 'en-us';
    }

    createVueI18n({ messages }) {
        const VueI18n = require('vue-i18n').default;

        const i18n = new VueI18n({
            locale: this.locale,
            fallbackLocale: this.fallbackLocale,
            messages: defaultsDeep(messages, this.Modules.i18n),
        })
        return i18n;
    }
}
