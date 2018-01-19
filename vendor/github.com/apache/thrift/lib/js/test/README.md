Thrift Javascript Library
=========================
This browser based Apache Thrift implementation supports
RPC clients using the JSON protocol over Http[s] with XHR
and WebSocket.

License
-------
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.

Test Servers
------------
drwxr-xr-x 2 randy randy  4096 Feb  8 15:44 sec
-rw-r--r-- 1 randy randy  2183 Feb  9 04:01 server_http.js
-rw-r--r-- 1 randy randy  2386 Feb  9 05:39 server_https.js

server_http.js is a Node.js web server which support the
standard Apache Thrift test suite (thrift/test/ThriftTest.thrift).
The server supports Apache Thrift XHR and WebSocket clients.

server_https.js is the same but uses SSL/TLS. The server key 
and cert are pulled from the thrift/test/keys folder.

Both of these servers support WebSocket (the http: supports ws:,
and the https: support wss:).

To run the client test with the Java test server use: 
$ make check (requires the Apache Thrift Java branch 
and make check must have been run in thrift/lib/java 
previously).

To run the client tests with the Node servers run the grunt
 build in the parent js directory (see README there).
 
Test Clients
------------
-rw-r--r-- 1 randy randy 13558 Feb  9 07:18 test-async.js
-rw-r--r-- 1 randy randy  5724 Feb  9 03:45 test_handler.js
-rwxr-xr-x 1 randy randy  2719 Feb  9 06:04 test.html
-rw-r--r-- 1 randy randy  4611 Feb  9 06:05 test-jq.js
-rwxr-xr-x 1 randy randy 12153 Feb  9 06:04 test.js
-rw-r--r-- 1 randy randy  2593 Feb  9 06:16 test-nojq.html
-rw-r--r-- 1 randy randy  1450 Feb  9 06:14 test-nojq.js
-rw-r--r-- 1 randy randy  2847 Feb  9 06:31 testws.html

There are three html test driver files, all of which are
QUnit based. test.html tests the Apache Thrift jQuery
generated code (thrift -gen js:jquery). The test-nojq.html
runs almost identical tests against normal JavaScript builds
(thrift -gen js). Both of the previous tests use the XHR 
transport. The testws.html runs similar tests using the
WebSocket transport. The test*.js files are loaded by the
html drivers and contain the actual Apache Thrift tests.
