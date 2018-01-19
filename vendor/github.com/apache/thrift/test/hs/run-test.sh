#!/bin/sh

#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

if [ "x" = "x$1" ]; then
  printf "run-test.sh needs an argument, the name of the test to run. Try 'ThriftTest' or 'ProtoDebugTest'\n"
  exit 2
fi

# Check some basics
if [ -z $BASE ]; then
    BASE=../..
fi

# Figure out what file to run has a server
if [ -z $TEST_SOURCE_FILE ]; then
    TEST_SOURCE_FILE=$BASE/test/hs/$1_Main.hs
fi

if [ ! -e $TEST_SOURCE_FILE ]; then
    printf "Missing server code file $TEST_SOURCE_FILE \n"
    exit 3
fi

printf "Running test... \n"
runhaskell -Wall -XScopedTypeVariables -i$BASE/lib/hs/src -igen-hs $TEST_SOURCE_FILE
