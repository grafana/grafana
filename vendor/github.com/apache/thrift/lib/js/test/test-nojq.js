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
 /* jshint -W100 */
 
/*
 * JavaScript test suite for ThriftTest.thrift. These tests
 * will run only with normal "-gen js" Apache Thrift interfaces.
 * To create client code:
 *      $ thrift -gen js ThriftTest.thrift
 *
 * See also:
 * ++ test.js for generic tests  
 * ++ test-jq.js for "-gen js:jquery" only tests
 */


//////////////////////////////////
//Async exception tests

module("NojQ Async");

  test("Xception", function() {
    expect( 2 );

    QUnit.stop();

    client.testException("Xception", function(result) {
      equal(result.errorCode, 1001);
      equal(result.message, "Xception");
      QUnit.start();
    });
  });

