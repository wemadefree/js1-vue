import { isFunction } from '@olibm/js1'
import * as JS1 from '@olibm/js1'

export default function () {
    return Object.keys(JS1).map(name => {
        if (isFunction(JS1[name])) {
            return {
                name,
                function: JS1[name],
            }
        }
    }).filter(x => x);
}
