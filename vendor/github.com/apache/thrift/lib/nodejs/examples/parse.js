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
/**

  This is a standalone deserialize/parse example if you just want to deserialize
  thrift decoupled from cassandra server

  1.  acquire thrift template specification files from who ever built it (eg: EXAMPLE.thrift)

  2.  Install thrift on local machine

  3.  generate thrift clients for nodejs using template specification files (#1)
      thrift --gen js:node schema/EXAMPLE.thrift

      This creates creates gen-node.js directory containing a new file, GENERATED.js

  4.  Inside GENERATED.js is a class you will want to instanciate.  Find this class name and plug 
      it into the example code below  (ie, "YOUR_CLASS_NAME")
 */

function parseThrift(thriftEncodedData, callback) {
  var thrift = require('thrift');
  var transport = new thrift.TFramedTransport(thriftEncodedData);
  var protocol  = new thrift.TBinaryProtocol(transport);

  var clientClass = require('../gen-nodejs/GENERATED').YOUR_CLASS_NAME;
  var client = new clientClass();
  client.read(protocol);
  callback(null, client);
}
