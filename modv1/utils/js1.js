import * as JS1 from '@we-made/js1'
import { isFunction } from '../../wraputil.mjs'

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
