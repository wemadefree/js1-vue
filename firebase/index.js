let firebase;

export function setFirebase(fb) {
    firebase = fb;
    return firebase;
}

export function getFirebase() {
    if (!firebase) {
        throw new Error('getFirebase() error: did you forget to run setFirebase() first?');
    }
    return firebase;
}