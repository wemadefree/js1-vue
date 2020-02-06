export function fixFirebaseData(snap) {
    if (!snap.exists) {
        return null;
    }
    return { ...snap.data(), id: snap.id };
}

export function mapFirebaseData(querySnap) {
    return querySnap.docs.map(fixFirebaseData);
}
