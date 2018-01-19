/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * 'License'); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

//This is the server side Node test handler for the standard
//  Apache Thrift test service.

var ttypes = require('./gen-nodejs/ThriftTest_types');
var TException = require('thrift').Thrift.TException;

function makeSyncHandler(label) {
  return function(thing) {
    //console.log(label + '(\'' + thing + '\')');
    return thing;
  }
}

var syncHandlers = {
  testVoid: testVoid,
  testMapMap: testMapMap,
  testInsanity: testInsanity,
  testMulti: testMulti,
  testException: testException,
  testMultiException: testMultiException,
  testOneway: testOneway
};

function makeAsyncHandler(label) {
  return function(thing, result) {
    thing = syncHandlers[label](thing);
    result(null, thing);
  }
}

var asyncHandlers = {
  testVoid: testVoidAsync,
  testMulti: testMultiAsync,
  testException: testExceptionAsync,
  testMultiException: testMultiExceptionAsync,
  testOneway: testOnewayAsync
};

var identityHandlers = [
  'testString',
  'testBool',
  'testByte',
  'testI32',
  'testI64',
  'testDouble',
  'testBinary',
  'testStruct',
  'testNest',
  'testMap',
  'testStringMap',
  'testSet',
  'testList',
  'testEnum',
  'testTypedef'
];

function testVoid() {
  //console.log('testVoid()');
}

function testVoidAsync(result) {
  result(testVoid());
}

function testMapMap(hello) {
  //console.log('testMapMap(' + hello + ')');

  var mapmap = [];
  var pos = [];
  var neg = [];
  for (var i = 1; i < 5; i++) {
    pos[i] = i;
    neg[-i] = -i;
  }
  mapmap[4] = pos;
  mapmap[-4] = neg;

  return mapmap;
}

function testInsanity(argument) {
  //console.log('testInsanity(');
  //console.log(argument);
  //console.log(')');

  var first_map = [];
  var second_map = [];

  first_map[ttypes.Numberz.TWO] = argument;
  first_map[ttypes.Numberz.THREE] = argument;

  var looney = new ttypes.Insanity();
  second_map[ttypes.Numberz.SIX] = looney;

  var insane = [];
  insane[1] = first_map;
  insane[2] = second_map;

  //console.log('insane result:');
  //console.log(insane);
  return insane;
}

function testMulti(arg0, arg1, arg2, arg3, arg4, arg5) {
  //console.log('testMulti()');

  var hello = new ttypes.Xtruct();
  hello.string_thing = 'Hello2';
  hello.byte_thing = arg0;
  hello.i32_thing = arg1;
  hello.i64_thing = arg2;
  return hello;
}

function testMultiAsync(arg0, arg1, arg2, arg3, arg4, arg5, result) {
  var hello = testMulti(arg0, arg1, arg2, arg3, arg4, arg5);
  result(null, hello);
}

function testException(arg) {
  //console.log('testException('+arg+')');
  if (arg === 'Xception') {
    var x = new ttypes.Xception();
    x.errorCode = 1001;
    x.message = arg;
    throw x;
  } else if (arg === 'TException') {
    throw new TException(arg);
  } else {
    return;
  }
}

function testExceptionAsync(arg, result) {
  //console.log('testException('+arg+')');
  if (arg === 'Xception') {
    var x = new ttypes.Xception();
    x.errorCode = 1001;
    x.message = arg;
    result(x);
  } else if (arg === 'TException') {
    result(new TException(arg));
  } else {
    result(null);
  }
}

function testMultiException(arg0, arg1) {
  //console.log('testMultiException(' + arg0 + ', ' + arg1 + ')');
  if (arg0 === ('Xception')) {
    var x = new ttypes.Xception();
    x.errorCode = 1001;
    x.message = 'This is an Xception';
    throw x;
  } else if (arg0 === ('Xception2')) {
    var x2 = new ttypes.Xception2();
    x2.errorCode = 2002;
    x2.struct_thing = new ttypes.Xtruct();
    x2.struct_thing.string_thing = 'This is an Xception2';
    throw x2;
  }

  var res = new ttypes.Xtruct();
  res.string_thing = arg1;
  return res;
}

function testMultiExceptionAsync(arg0, arg1, result) {
  //console.log('testMultiException(' + arg0 + ', ' + arg1 + ')');
  if (arg0 === ('Xception')) {
    var x = new ttypes.Xception();
    x.errorCode = 1001;
    x.message = 'This is an Xception';
    result(x);
  } else if (arg0 === ('Xception2')) {
    var x2 = new ttypes.Xception2();
    x2.errorCode = 2002;
    x2.struct_thing = new ttypes.Xtruct();
    x2.struct_thing.string_thing = 'This is an Xception2';
    result(x2);
  } else {
    var res = new ttypes.Xtruct();
    res.string_thing = arg1;
    result(null, res);
  }
}

function testOneway(sleepFor) {
  //console.log('testOneway(' + sleepFor + ') => JavaScript (like Rust) never sleeps!');
}

function testOnewayAsync(sleepFor, result) {
  testOneway(sleepFor);
}

identityHandlers.forEach(function(label) {
  syncHandlers[label] = makeSyncHandler(label);
  asyncHandlers[label] = makeAsyncHandler(label);
});

['testMapMap', 'testInsanity'].forEach(function(label) {
  asyncHandlers[label] = makeAsyncHandler(label);
});

exports.ThriftTestHandler = asyncHandlers;

exports.AsyncThriftTestHandler = asyncHandlers;
exports.SyncThriftTestHandler = asyncHandlers;
