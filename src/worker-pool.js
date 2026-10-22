const { Worker } = require('node:worker_threads');
const path = require('node:path');

class WorkerPool {
  constructor(maxWorkers) {
    if (!Number.isInteger(maxWorkers) || maxWorkers < 1) {
      throw new Error('MAX_WORKERS must be a positive integer');
    }
    this.maxWorkers = maxWorkers;
    this.activeWorkers = 0;
    this.queue = [];
  }

  execute(reservationId) {
    return new Promise((resolve, reject) => {
      this.queue.push({ reservationId, resolve, reject });
      this.processQueue();
    });
  }

  processQueue() {
    while (this.activeWorkers < this.maxWorkers && this.queue.length > 0) {
      const task = this.queue.shift();
      let worker;
      try {
        worker = new Worker(path.join(__dirname, 'cpu-worker.js'), {
          workerData: { reservationId: task.reservationId },
        });
      } catch (error) {
        task.reject(error);
        continue;
      }
      this.activeWorkers++;
      let result;
      let failure;
      worker.once('message', (data) => {
        if (data && data.error) failure = new Error(data.error);
        else result = data;
      });
      worker.once('error', (error) => { failure = error; });
      worker.once('exit', (code) => {
        this.activeWorkers--;
        if (failure) task.reject(failure);
        else if (code !== 0) task.reject(new Error(`Worker exited with code ${code}`));
        else if (!result) task.reject(new Error('Worker returned no result'));
        else task.resolve(result);
        this.processQueue();
      });
    }
  }

  getStats() {
    return {
      maxWorkers: this.maxWorkers,
      activeWorkers: this.activeWorkers,
      queuedTasks: this.queue.length,
    };
  }
}

module.exports = WorkerPool;
