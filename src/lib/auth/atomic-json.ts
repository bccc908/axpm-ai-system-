import { mkdir, open, rename, stat, unlink, writeFile } from "fs/promises";
import path from "path";

const tails = new Map<string, Promise<unknown>>();

/**
 * One writer at a time for a JSON file. An in-process queue plus an exclusive
 * lock file so two sign-ups in the same process cannot drop each other's row.
 * A lock older than 15s is treated as abandoned.
 */
export async function withFileLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const prev = tails.get(lockPath) ?? Promise.resolve();
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  tails.set(
    lockPath,
    prev.then(
      () => gate,
      () => gate,
    ),
  );
  await prev.catch(() => undefined);

  try {
    await mkdir(path.dirname(lockPath), { recursive: true });
    const started = Date.now();
    let handle: Awaited<ReturnType<typeof open>> | null = null;
    while (!handle) {
      try {
        handle = await open(lockPath, "wx");
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST") throw error;
        try {
          const info = await stat(lockPath);
          if (Date.now() - info.mtimeMs > 15_000) {
            await unlink(lockPath);
            continue;
          }
        } catch {
          continue;
        }
        if (Date.now() - started > 5_000) {
          throw new Error("Timed out waiting for the users file lock");
        }
        await new Promise((resolve) => setTimeout(resolve, 20));
      }
    }
    try {
      return await fn();
    } finally {
      await handle.close();
      await unlink(lockPath).catch(() => undefined);
    }
  } finally {
    release();
  }
}

/** Write JSON via a temp file in the same directory, then rename over the target. */
export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`,
  );
  await writeFile(tmp, JSON.stringify(value, null, 2), "utf8");
  await rename(tmp, filePath);
}
