/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

var test = require('tape');
var binary = require('thrift/binary');

var cases = {
  "Should read signed byte": function(assert){
    assert.equal(1, binary.readByte(0x01));
    assert.equal(-1, binary.readByte(0xFF));

    assert.equal(127, binary.readByte(0x7F));
    assert.equal(-128, binary.readByte(0x80));
    assert.end();
  },
  "Should write byte": function(assert){
    //Protocol simply writes to the buffer. Nothing to test.. yet.
    assert.ok(true);
    assert.end();
  },
  "Should read I16": function(assert) {
    assert.equal(0, binary.readI16([0x00, 0x00]));
    assert.equal(1, binary.readI16([0x00, 0x01]));
    assert.equal(-1, binary.readI16([0xff, 0xff]));

    // Min I16
    assert.equal(-32768, binary.readI16([0x80, 0x00]));
    // Max I16
    assert.equal(32767, binary.readI16([0x7f, 0xff]));
    assert.end();
  },

  "Should write I16": function(assert) {
    assert.deepEqual([0x00, 0x00], binary.writeI16([], 0));
    assert.deepEqual([0x00, 0x01], binary.writeI16([], 1));
    assert.deepEqual([0xff, 0xff], binary.writeI16([], -1));

    // Min I16
    assert.deepEqual([0x80, 0x00], binary.writeI16([], -32768));
    // Max I16
    assert.deepEqual([0x7f, 0xff], binary.writeI16([], 32767));
    assert.end();
  },

  "Should read I32": function(assert) {
    assert.equal(0, binary.readI32([0x00, 0x00, 0x00, 0x00]));
    assert.equal(1, binary.readI32([0x00, 0x00, 0x00, 0x01]));
    assert.equal(-1, binary.readI32([0xff, 0xff, 0xff, 0xff]));

    // Min I32
    assert.equal(-2147483648, binary.readI32([0x80, 0x00, 0x00, 0x00]));
    // Max I32
    assert.equal(2147483647, binary.readI32([0x7f, 0xff, 0xff, 0xff]));
    assert.end();
  },

  "Should write I32": function(assert) {
    assert.deepEqual([0x00, 0x00, 0x00, 0x00], binary.writeI32([], 0));
    assert.deepEqual([0x00, 0x00, 0x00, 0x01], binary.writeI32([], 1));
    assert.deepEqual([0xff, 0xff, 0xff, 0xff], binary.writeI32([], -1));

    // Min I32
    assert.deepEqual([0x80, 0x00, 0x00, 0x00], binary.writeI32([], -2147483648));
    // Max I32
    assert.deepEqual([0x7f, 0xff, 0xff, 0xff], binary.writeI32([], 2147483647));
    assert.end();
  },

  "Should read doubles": function(assert) {
    assert.equal(0, binary.readDouble([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
    assert.equal(0, binary.readDouble([0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
    assert.equal(1, binary.readDouble([0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
    assert.equal(2, binary.readDouble([0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
    assert.equal(-2, binary.readDouble([0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))

    assert.equal(Math.PI, binary.readDouble([0x40, 0x9, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18]))

    assert.equal(Infinity, binary.readDouble([0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
    assert.equal(-Infinity, binary.readDouble([0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))

    assert.ok(isNaN(binary.readDouble([0x7f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])))

    assert.equal(1/3, binary.readDouble([0x3f, 0xd5, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55]))

    // Min subnormal positive double
    assert.equal(4.9406564584124654e-324, binary.readDouble([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]))
    // Min normal positive double
    assert.equal(2.2250738585072014e-308, binary.readDouble([0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
    // Max positive double
    assert.equal(1.7976931348623157e308, binary.readDouble([0x7f, 0xef, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]))
    assert.end();
  },

  "Should write doubles": function(assert) {
    assert.deepEqual([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], 0));
    assert.deepEqual([0x3f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], 1));
    assert.deepEqual([0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], 2));
    assert.deepEqual([0xc0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], -2));

    assert.deepEqual([0x40, 0x9, 0x21, 0xfb, 0x54, 0x44, 0x2d, 0x18], binary.writeDouble([], Math.PI));

    assert.deepEqual([0x7f, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], Infinity));
    assert.deepEqual([0xff, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], -Infinity));

    assert.deepEqual([0x7f, 0xf8, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], NaN));

    assert.deepEqual([0x3f, 0xd5, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55], binary.writeDouble([], 1/3));

    // Min subnormal positive double
    assert.deepEqual([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01], binary.writeDouble([], 4.9406564584124654e-324));
    // Min normal positive double
    assert.deepEqual([0x00, 0x10, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00], binary.writeDouble([], 2.2250738585072014e-308));
    // Max positive double
    assert.deepEqual([0x7f, 0xef, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff], binary.writeDouble([], 1.7976931348623157e308));
    assert.end();
  }
};

Object.keys(cases).forEach(function(caseName) {
  test(caseName, cases[caseName]);
});
