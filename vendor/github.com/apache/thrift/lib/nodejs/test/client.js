#!/usr/bin/env node

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

var fs = require('fs');
var assert = require('assert');
var thrift = require('thrift');
var helpers = require('./helpers');
var ThriftTest = require('./gen-nodejs/ThriftTest');
var ThriftTestDriver = require('./test_driver').ThriftTestDriver;
var ThriftTestDriverPromise = require('./test_driver').ThriftTestDriverPromise;
var SecondService = require('./gen-nodejs/SecondService');
var ttypes = require('./gen-nodejs/ThriftTest_types');

var program = require('commander');

program
  .option('-p, --protocol <protocol>', 'Set thrift protocol (binary|json) [protocol]')
  .option('-t, --transport <transport>', 'Set thrift transport (buffered|framed) [transport]')
  .option('--port <port>', 'Set thrift server port number to connect', 9090)
  .option('--host <host>', 'Set thrift server host to connect', 'localhost')
  .option('--ssl', 'use SSL transport')
  .option('--promise', 'test with promise style functions')
  .option('-t, --type <type>', 'Select server type (tcp|multiplex|http)', 'tcp')
  .parse(process.argv);

var host = program.host;
var port = program.port;
var type = program.type;
var ssl = program.ssl;
var promise = program.promise;

var options = {
  transport: helpers.transports[program.transport],
  protocol: helpers.protocols[program.protocol]
};

if (type === 'http' || type === 'websocket') {
  options.path = '/test';
}

if (type === 'http') {
  options.headers = {"Connection": "close"};
}

if (ssl) {
  if (type === 'tcp' || type === 'multiplex') {
    options.rejectUnauthorized = false;
  } else if (type === 'http') {
    options.nodeOptions = { rejectUnauthorized: false };
    options.https = true;
  } else if (type === 'websocket') {
    options.wsOptions = { rejectUnauthorized: false };
    options.secure = true;
  }
}

var connection;
var client;
var testDriver = promise ? ThriftTestDriverPromise : ThriftTestDriver;

if (type === 'tcp' || type === 'multiplex') {
  connection = ssl ?
    thrift.createSSLConnection(host, port, options) :
    thrift.createConnection(host, port, options);
} else if (type === 'http') {
  connection = thrift.createHttpConnection(host, port, options);
} else if (type === 'websocket') {
  connection = thrift.createWSConnection(host, port, options);
  connection.open();
}

connection.on('error', function(err) {
    assert(false, err);
});

if (type === 'tcp') {
  client = thrift.createClient(ThriftTest, connection);
  runTests();
} else if (type === 'multiplex') {
  var mp = new thrift.Multiplexer();
  client = mp.createClient("ThriftTest", ThriftTest, connection);
  secondclient = mp.createClient("SecondService", SecondService, connection);

  connection.on('connect', function() {
    secondclient.secondtestString("Test", function(err, response) {
      assert(!err);
      assert.equal("Test", response);
    });

    runTests();
  });
} else if (type === 'http') {
  client = thrift.createHttpClient(ThriftTest, connection);
  runTests();
} else if (type === 'websocket') {
  client = thrift.createWSClient(ThriftTest, connection);
  runTests();
}

function runTests() {
  testDriver(client, function (status) {
    console.log(status);
    if (type !== 'http' && type !== 'websocket') {
      connection.end();
    }
    if (type !== 'multiplex') {
      process.exit(0);
    }
  });
}

exports.expressoTest = function() {};
