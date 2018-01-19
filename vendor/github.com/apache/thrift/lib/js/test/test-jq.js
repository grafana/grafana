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
 * will run only with jQuery (-gen js:jquery) Apache Thrift
 * interfaces. To create client code:
 *      $ thrift -gen js:jquery ThriftTest.thrift
 *
 * See also:
 * ++ test.js for generic tests
 * ++ test-nojq.js for "-gen js" only tests
 */


//////////////////////////////////
//jQuery asynchronous tests
jQuery.ajaxSetup({ timeout: 0 });
$(document).ajaxError( function() { QUnit.start(); } );

module("jQ Async Manual");

  test("testI32", function() {
    expect( 2 );
    QUnit.stop();

    var transport = new Thrift.Transport();
    var protocol  = new Thrift.Protocol(transport);
    var client    = new ThriftTest.ThriftTestClient(protocol);

    var jqxhr = jQuery.ajax({
      url: "/service",
      data: client.send_testI32(Math.pow(-2,31)),
      type: "POST",
      cache: false,
      dataType: "text",
      success: function(res){
        transport.setRecvBuffer( res );
        equal(client.recv_testI32(), Math.pow(-2,31));
      },
      error: function() { ok(false); },
      complete: function() {
        ok(true);
        QUnit.start();
      }
    });
  });

  test("testI64", function() {
    expect( 2 );
    QUnit.stop();

    var transport = new Thrift.Transport();
    var protocol  = new Thrift.Protocol(transport);
    var client    = new ThriftTest.ThriftTestClient(protocol);

    jQuery.ajax({
      url: "/service",
      //This is usually 2^61 but JS cannot represent anything over 2^52 accurately
      data: client.send_testI64(Math.pow(-2,52)),
      type: "POST",
      cache: false,
      dataType: "text",
      success: function(res){
        transport.setRecvBuffer( res );
        //This is usually 2^61 but JS cannot represent anything over 2^52 accurately
        equal(client.recv_testI64(), Math.pow(-2,52));
      },
      error: function() { ok(false); },
      complete: function() {
        ok(true);
        QUnit.start();
      }
    });
  });


module("jQ Async");
  test("I32", function() {
    expect( 3 );

    QUnit.stop();
    client.testI32(Math.pow(2,30), function(result) {
      equal(result, Math.pow(2,30));
      QUnit.start();
    });

    QUnit.stop();
    var jqxhr = client.testI32(Math.pow(-2,31), function(result) {
      equal(result, Math.pow(-2,31));
    });

    jqxhr.success(function(result) {
      equal(result, Math.pow(-2,31));
      QUnit.start();
    });
  });

  test("I64", function() {
    expect( 4 );

    QUnit.stop();
    //This is usually 2^60 but JS cannot represent anything over 2^52 accurately
    client.testI64(Math.pow(2,52), function(result) {
      equal(result, Math.pow(2,52));
      QUnit.start();
    });

    QUnit.stop();
    //This is usually 2^60 but JS cannot represent anything over 2^52 accurately
    client.testI64(Math.pow(-2,52), function(result) {
      equal(result, Math.pow(-2,52));
    })
    .error( function(xhr, status, e) {  ok(false, e.message); } )
    .success(function(result) {
      //This is usually 2^60 but JS cannot represent anything over 2^52 accurately
      equal(result, Math.pow(-2,52));
    })
    .complete(function() {
      ok(true);
      QUnit.start();
    });
  });

  test("Xception", function() {
    expect( 2 );

    QUnit.stop();

    var dfd = client.testException("Xception", function(result) {
      ok(false);
      QUnit.start();
    })
    .error(function(xhr, status, e){
      equal(e.errorCode, 1001);
      equal(e.message, "Xception");
      //QUnit.start();
      //Note start is not required here because:
      //$(document).ajaxError( function() { QUnit.start(); } );
    });
  });
