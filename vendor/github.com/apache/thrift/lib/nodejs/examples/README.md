# Thrift Node.js Examples

## License
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

## Running the user example

Generate the bindings:

    ../../../compiler/cpp/thrift --gen js:node user.thrift
    ../../../compiler/cpp/thrift --gen js:node --gen py hello.thrift

To run the user example, first start up the server in one terminal:

    NODE_PATH=../lib:../lib/thrift node server.js

Now run the client:

    NODE_PATH=../lib:../lib/thrift node client.js

For an example using JavaScript in the browser to connect to
a node.js server look at hello.html, hello.js and hello.thrift

HTTP examples are provided also: httpClient.js and httpServer.js
You can test HTTP cross platform with the httpServer.py Python server
