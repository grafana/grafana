class Logger {
  #stream;
  #errorStream;
  #enabled;

  // Diagnostics use stderr so stdout stays parseable even when LOG enables progress.
  constructor({ stream = process.stderr, errorStream = process.stderr, enabled = process.env.LOG !== undefined } = {}) {
    this.#stream = stream;
    this.#errorStream = errorStream;
    this.#enabled = enabled;
  }

  log(message) {
    if (!this.#enabled) {
      return;
    }
    if (message === '') {
      this.#stream.write('\n');
    } else {
      this.#write(this.#stream, message);
    }
  }

  // Always report errors, even when progress logging is disabled.
  error(message) {
    this.#write(this.#errorStream, message);
  }

  #write(stream, message) {
    stream.write(`${new Date().toISOString()} ${message}\n`);
  }
}

// Share the same logging settings across the CLI.
const logger = new Logger();

module.exports = { Logger, logger };
