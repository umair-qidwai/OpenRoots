/** Expo's web SQLite VFS bootstrap must complete before a second DB is opened. */
export async function initializeServices(
  dictionary: () => Promise<void>,
  userState: () => Promise<void>,
): Promise<void> {
  await dictionary();
  await userState();
}
