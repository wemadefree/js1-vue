import { getFirebase } from '../index'

export async function beginOnIdTokenChanged(fn) {
    const firebase = getFirebase();
    const fbAuth = firebase.auth();

    await new Promise((_resolve, _reject) => {
        let _promResolved = false;
        const promResolve = err => {
            if (!_promResolved) {
                _promResolved = true;
                if (err) {
                    _reject(err);
                }
                else {
                    _resolve();
                }
            }
        }
        fbAuth.onIdTokenChanged(async function (fbid) {
            try {
                let ev = {
                    isAuthenticated: !!fbid,
                    fbid: fbid,
                    fbidTokenResult: null,
                    bearer: null,
                    claims: {},
                    user: null,
                };
                if (fbid) {
                    fbAuth.tenantId = fbid.tenantId; // This is NOT our tenantId. This is the Google Identity Platform tenant id.

                    ev.fbidTokenResult = await fbid.getIdTokenResult();
                    ev.bearer = ev.fbidTokenResult.token || null;
                    ev.claims = ev.fbidTokenResult.claims || {};
                }

                await fn(ev);
            }
            catch (err) {
                promResolve(err);
            }
            finally {
                promResolve();
            }
        })
    });
}
