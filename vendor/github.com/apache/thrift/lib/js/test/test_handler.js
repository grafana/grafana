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
var TException = require('../../nodejs/lib/thrift').TException;

var ThriftTestHandler = exports.ThriftTestHandler = {
  testVoid: function(result) {
    console.log('testVoid()');
    result(null);
  },
  testString: function(thing, result) {
    console.log('testString(\'' + thing + '\')');
    result(null, thing);
  },
  testByte: function(thing, result) {
    console.log('testByte(' + thing + ')');
    result(null, thing);
  },
  testI32: function(thing, result) {
    console.log('testI32(' + thing + ')');
    result(null, thing);
  },
  testI64: function(thing, result) {
    console.log('testI64(' + thing + ')');
    result(null, thing);
  },
  testDouble: function(thing, result) {
    console.log('testDouble(' + thing + ')');
    result(null, thing);
  },
  testBinary: function(thing, result) {
    console.log('testBinary(\'' + thing + '\')');
    result(null, thing);
  },
  testStruct: function(thing, result) {
    console.log('testStruct(');
    console.log(thing);
    console.log(')');
    result(null, thing);
  },
  testNest: function(nest, result) {
    console.log('testNest(');
    console.log(nest);
    console.log(')');
    result(null, nest);
  },
  testMap: function(thing, result) {
    console.log('testMap(');
    console.log(thing);
    console.log(')');
    result(null, thing);
  },
  testStringMap: function(thing, result) {
    console.log('testStringMap(');
    console.log(thing);
    console.log(')');
    result(null, thing);
  },
  testSet: function(thing, result) {
    console.log('testSet(');
    console.log(thing);
    console.log(')');
    result(null, thing);
  },
  testList: function(thing, result) {
    console.log('testList(');
    console.log(thing);
    console.log(')');
    result(null, thing);
  },
  testEnum: function(thing, result) {
    console.log('testEnum(' + thing + ')');
    result(null, thing);
  },
  testTypedef: function(thing, result) {
    console.log('testTypedef(' + thing + ')');
    result(null, thing);
  },
  testMapMap: function(hello, result) {
    console.log('testMapMap(' + hello + ')');

    var mapmap = [];
    var pos = [];
    var neg = [];
    for (var i = 1; i < 5; i++) {
      pos[i] = i;
      neg[-i] = -i;
    }
    mapmap[4] = pos;
    mapmap[-4] = neg;

    result(null, mapmap);
  },
  testInsanity: function(argument, result) {
    console.log('testInsanity(');
    console.log(argument);
    console.log(')');

    var hello = new ttypes.Xtruct();
    hello.string_thing = 'Hello2';
    hello.byte_thing = 2;
    hello.i32_thing = 2;
    hello.i64_thing = 2;

    var goodbye = new ttypes.Xtruct();
    goodbye.string_thing = 'Goodbye4';
    goodbye.byte_thing = 4;
    goodbye.i32_thing = 4;
    goodbye.i64_thing = 4;

    var crazy = new ttypes.Insanity();
    crazy.userMap = [];
    crazy.userMap[ttypes.Numberz.EIGHT] = 8;
    crazy.userMap[ttypes.Numberz.FIVE] = 5;
    crazy.xtructs = [goodbye, hello];

    var first_map = [];
    var second_map = [];

    first_map[ttypes.Numberz.TWO] = crazy;
    first_map[ttypes.Numberz.THREE] = crazy;

    var looney = new ttypes.Insanity();
    second_map[ttypes.Numberz.SIX] = looney;

    var insane = [];
    insane[1] = first_map;
    insane[2] = second_map;

    console.log('insane result:');
    console.log(insane);
    result(null, insane);
  },
  testMulti: function(arg0, arg1, arg2, arg3, arg4, arg5, result) {
    console.log('testMulti()');

    var hello = new ttypes.Xtruct();
    hello.string_thing = 'Hello2';
    hello.byte_thing = arg0;
    hello.i32_thing = arg1;
    hello.i64_thing = arg2;
    result(null, hello);
  },
  testException: function(arg, result) {
    console.log('testException('+arg+')');
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
  },
  testMultiException: function(arg0, arg1, result) {
    console.log('testMultiException(' + arg0 + ', ' + arg1 + ')');
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
    }

    var res = new ttypes.Xtruct();
    res.string_thing = arg1;
    result(null, res);
  },
  testOneway: function(sleepFor, result) {
    console.log('testOneway(' + sleepFor + ') => JavaScript (like Rust) never sleeps!');
  }
};   //ThriftTestSvcHandler
