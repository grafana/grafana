#!/bin/sh

# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# 'License'); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
# http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# 'AS IS' BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.

set -e;
rm -r gen-dart || true;

thrift --gen dart ../shared.thrift;
cd gen-dart/shared;
pub get;
cd ../..;

thrift --gen dart ../tutorial.thrift;
cd gen-dart/tutorial;
pub get;
cd ../..;

cd client;
pub get;
cd ..;

cd console_client;
pub get;
cd ..;

cd server;
pub get;
cd ..;

dartfmt -w gen-dart;

echo "\nEnjoy the Dart tutorial!";
echo "\nTo run the server:";
echo "> dart server/bin/main.dart";
echo "\nTo run the client:";
echo "# Serve the app from the client directory and view in a browser";
echo "> cd client;";
echo "> pub serve;";
echo "\nTo run the console client:";
echo "> dart console_client/bin/main.dart";
echo "";
