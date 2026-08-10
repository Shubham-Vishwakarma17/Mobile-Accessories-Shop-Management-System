export const OWNER_UID = 'Gz9BvDKMVVan8IbRc7uD1RWcuOX2';

const firebaseProjectId = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID?.trim() || 'local';
const safeProjectId = firebaseProjectId.replace(/[^a-zA-Z0-9_-]/g, '-');
const safeOwnerId = OWNER_UID.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 16);

export const LOCAL_DATABASE_NAME = `accessories-${safeProjectId}-${safeOwnerId}.db`;
