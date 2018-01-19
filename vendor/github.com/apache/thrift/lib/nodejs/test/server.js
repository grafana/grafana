#!/usr/bin/env node

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

var fs = require('fs');
var path = require('path');
var thrift = require('../lib/thrift');
var program = require('commander');
var helpers = require('./helpers');

var ThriftTest = require('./gen-nodejs/ThriftTest');
var SecondService = require('./gen-nodejs/SecondService');
var ThriftTestHandler = require('./test_handler').AsyncThriftTestHandler;
var ThriftTestHandlerPromise = require('./test_handler').SyncThriftTestHandler;
var ttypes = require('./gen-nodejs/ThriftTest_types');

program
  .option('-p, --protocol <protocol>', 'Set thrift protocol (binary|json|compact)', 'binary')
  .option('-t, --transport <transport>', 'Set thrift transport (buffered|framed)', 'buffered')
  .option('--ssl', 'use ssl transport')
  .option('--port <port>', 'Set thrift server port', 9090)
  .option('--promise', 'test with promise style functions')
  .option('-t, --type <type>', 'Select server type (tcp|multiplex|http)', 'tcp')
  .parse(process.argv);

var port = program.port;
var type = program.type;
var ssl = program.ssl;
var promise = program.promise;

var handler = program.promise ? ThriftTestHandler : ThriftTestHandlerPromise;

var options = {
  transport: helpers.transports[program.transport],
  protocol: helpers.protocols[program.protocol]
};

if (type === 'http' || type ==='websocket') {
  options.handler = handler;
  options.processor = ThriftTest;

  options = {
    services: { "/test": options },
    cors: {
      '*': true
    }
  }
}

if (type === 'multiplex') {
  var SecondServiceHandler = {
    secondtestString: function(thing, result) {
      console.log('testString(\'' + thing + '\')');
      result(null, thing);
    }
  };

  var processor = new thrift.MultiplexedProcessor();

  processor.registerProcessor("ThriftTest",
    new ThriftTest.Processor(ThriftTestHandler));

  processor.registerProcessor("SecondService",
    new SecondService.Processor(SecondServiceHandler));

}

if (ssl) {
  options.tls = {
    key: fs.readFileSync(path.resolve(__dirname, 'server.key')),
    cert: fs.readFileSync(path.resolve(__dirname, 'server.crt'))
  };
}

var server;
if (type === 'tcp') {
  server = thrift.createServer(ThriftTest, handler, options);
} else if (type === 'multiplex') {
  server = thrift.createMultiplexServer(processor, options);
} else if (type === 'http' || type === 'websocket') {
  server = thrift.createWebServer(options);
}

server.listen(port);
