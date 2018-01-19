'use strict';
var test = require('tape');
var thrift = require('../lib/thrift/thrift.js');
var InputBufferUnderrunError = require('../lib/thrift/input_buffer_underrun_error');

test('TApplicationException', function t(assert) {
  var e = new thrift.TApplicationException(1, 'foo');
  assert.ok(e instanceof thrift.TApplicationException, 'is instanceof TApplicationException');
  assert.ok(e instanceof thrift.TException, 'is instanceof TException');
  assert.ok(e instanceof Error, 'is instanceof Error');
  assert.equal(typeof e.stack, 'string', 'has stack trace');
  assert.ok(/^TApplicationException: foo/.test(e.stack), 'Stack trace has correct error name and message');
  assert.ok(e.stack.indexOf('test/exceptions.js:7:11') !== -1, 'stack trace starts on correct line and column');
  assert.equal(e.name, 'TApplicationException', 'has function name TApplicationException');
  assert.equal(e.message, 'foo', 'has error message "foo"');
  assert.equal(e.type, 1, 'has type 1');
  assert.end();
});

test('TException', function t(assert) {
  var e = new thrift.TException('foo');
  assert.ok(e instanceof thrift.TException, 'is instanceof TException');
  assert.ok(e instanceof Error, 'is instanceof Error');
  assert.equal(typeof e.stack, 'string', 'has stack trace');
  assert.ok(/^TException: foo/.test(e.stack), 'Stack trace has correct error name and message');
  assert.ok(e.stack.indexOf('test/exceptions.js:21:11') !== -1, 'stack trace starts on correct line and column');
  assert.equal(e.name, 'TException', 'has function name TException');
  assert.equal(e.message, 'foo', 'has error message "foo"');
  assert.end();
});

test('TProtocolException', function t(assert) {
  var e = new thrift.TProtocolException(1, 'foo');
  assert.ok(e instanceof thrift.TProtocolException, 'is instanceof TProtocolException');
  assert.ok(e instanceof Error, 'is instanceof Error');
  assert.equal(typeof e.stack, 'string', 'has stack trace');
  assert.ok(/^TProtocolException: foo/.test(e.stack), 'Stack trace has correct error name and message');
  assert.ok(e.stack.indexOf('test/exceptions.js:33:11') !== -1, 'stack trace starts on correct line and column');
  assert.equal(e.name, 'TProtocolException', 'has function name TProtocolException');
  assert.equal(e.message, 'foo', 'has error message "foo"');
  assert.equal(e.type, 1, 'has type 1');
  assert.end();
});

test('InputBufferUnderrunError', function t(assert) {
  var e = new InputBufferUnderrunError('foo');
  assert.ok(e instanceof InputBufferUnderrunError, 'is instanceof InputBufferUnderrunError');
  assert.ok(e instanceof Error, 'is instanceof Error');
  assert.equal(typeof e.stack, 'string', 'has stack trace');
  assert.ok(/^InputBufferUnderrunError: foo/.test(e.stack), 'Stack trace has correct error name and message');
  assert.ok(e.stack.indexOf('test/exceptions.js:46:11') !== -1, 'stack trace starts on correct line and column');
  assert.equal(e.name, 'InputBufferUnderrunError', 'has function name InputBufferUnderrunError');
  assert.equal(e.message, 'foo', 'has error message "foo"');
  assert.end();
});
