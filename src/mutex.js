class Mutex {
  constructor() {
    this.locked = false;
    this.waiting = [];
  }

  lock() {
    return new Promise((resolve) => {
      if (!this.locked) {
        this.locked = true;
        resolve();
      } else {
        this.waiting.push(resolve);
      }
    });
  }

  unlock() {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next();
    } else {
      this.locked = false;
    }
  }

  async runExclusive(callback) {
    await this.lock();

    try {
      return await callback();
    } finally {
      this.unlock();
    }
  }
}

module.exports = Mutex;
