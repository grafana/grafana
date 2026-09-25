const assert = require('node:assert/strict');
const test = require('node:test');

const { Logger } = require('./logger');

function collectingStream() {
  const lines = [];
  return { lines, write: (text) => lines.push(text) };
}

function loggerWith(enabled) {
  const stream = collectingStream();
  const errorStream = collectingStream();
  return { logger: new Logger({ stream, errorStream, enabled }), stream, errorStream };
}

test('log: a message is written to the stream when enabled', () => {
  const { logger, stream } = loggerWith(true);

  logger.log('something happened');

  assert.equal(stream.lines.length, 1);
  assert.match(stream.lines[0], /something happened\n$/);
});

test('log: an empty message adds a blank line only when enabled', () => {
  for (const enabled of [true, false]) {
    const { logger, stream } = loggerWith(enabled);
    logger.log('');
    assert.deepEqual(stream.lines, enabled ? ['\n'] : []);
  }
});

test('log: messages are stamped with an ISO timestamp', () => {
  const { logger, stream } = loggerWith(true);

  logger.log('x');

  const [stamp] = stream.lines[0].split(' ');
  assert.ok(Number.isFinite(Date.parse(stamp)));
});

test('log: nothing is written when disabled', () => {
  const { logger, stream } = loggerWith(false);

  logger.log('x');

  assert.deepEqual(stream.lines, []);
});

test('error: written even when progress logging is disabled', () => {
  const { logger, errorStream } = loggerWith(false);

  logger.error('cache unreadable');

  assert.equal(errorStream.lines.length, 1);
  assert.match(errorStream.lines[0], /cache unreadable\n$/);
});

test('error: goes to the error stream, never to the progress stream', () => {
  const { logger, stream, errorStream } = loggerWith(true);

  logger.error('bad');

  assert.deepEqual(stream.lines, []);
  assert.equal(errorStream.lines.length, 1);
});

test('error: lines are stamped like progress lines', () => {
  const { logger, errorStream } = loggerWith(false);

  logger.error('bad');

  const [stamp] = errorStream.lines[0].split(' ');
  assert.ok(Number.isFinite(Date.parse(stamp)));
});

// Capture writes synchronously to check the default process streams.
function writesTo(stream, run) {
  const original = stream.write;
  const lines = [];
  stream.write = (text) => lines.push(text);
  try {
    run();
  } finally {
    stream.write = original;
  }
  return lines.filter((line) => line.includes('the message'));
}

test('the progress stream defaults to stderr and leaves stdout clean', () => {
  let lines;
  const stdout = writesTo(process.stdout, () => {
    lines = writesTo(process.stderr, () => new Logger({ enabled: true }).log('the message'));
  });

  assert.equal(lines.length, 1);
  assert.match(lines[0], /the message\n$/);
  assert.deepEqual(stdout, []);
});

test('the error stream defaults to stderr, not stdout', () => {
  const toStderr = writesTo(process.stderr, () => new Logger({ enabled: true }).error('the message'));
  const toStdout = writesTo(process.stdout, () => new Logger({ enabled: true }).error('the message'));

  assert.equal(toStderr.length, 1);
  assert.deepEqual(toStdout, []);
});

// The flag is read for its presence, not its value, so `LOG=0` turns logging on like anything else.
test('progress logging defaults to whether LOG is set', () => {
  const original = process.env.LOG;
  try {
    delete process.env.LOG;
    assert.deepEqual(
      writesTo(process.stderr, () => new Logger().log('the message')),
      []
    );

    process.env.LOG = '0';
    assert.equal(writesTo(process.stderr, () => new Logger().log('the message')).length, 1);
  } finally {
    if (original === undefined) {
      delete process.env.LOG;
    } else {
      process.env.LOG = original;
    }
  }
});
