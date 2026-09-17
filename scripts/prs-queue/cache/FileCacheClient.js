const { randomUUID } = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const { logger } = require('../logger/logger');

const SUFFIX = '.cache.json';

class FileCacheClient {
  #dir;

  constructor({ dir }) {
    this.#dir = dir;
  }

  // Treat missing and unreadable files as cache misses, but log unexpected read errors.
  async read(key) {
    try {
      const value = JSON.parse(await fs.readFile(this.pathFor(key), 'utf8'));
      logger.log(`cache hit ${key}`);
      return value;
    } catch (error) {
      if (error.code === 'ENOENT') {
        logger.log(`cache miss ${key}`);
      } else {
        logger.error(`cache unreadable ${key} (${this.pathFor(key)}): ${error.message}`);
      }
      return null;
    }
  }

  async write(key, value) {
    const file = this.pathFor(key);
    const tmp = path.join(this.#dir, `.${randomUUID()}.tmp`);
    await fs.mkdir(this.#dir, { recursive: true });
    const handle = await fs.open(tmp, 'wx');
    try {
      try {
        await handle.writeFile(JSON.stringify({ fetchedAt: new Date().toISOString(), ...value }, null, 2) + '\n');
      } finally {
        await handle.close();
      }
      // Each writer owns its temporary file; rename publishes one complete entry atomically.
      await fs.rename(tmp, file);
    } finally {
      await fs.rm(tmp, { force: true });
    }
    logger.log(`cache write ${key}`);
  }

  pathFor(key) {
    return path.join(this.#dir, `${key}${SUFFIX}`);
  }
}

module.exports = { FileCacheClient };
