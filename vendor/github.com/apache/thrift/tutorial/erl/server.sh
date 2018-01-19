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

ERL_THRIFT=../../lib/erl

if ! [ -d ${ERL_THRIFT}/ebin ]; then
    echo "Please build the Thrift library by running \`make' in ${ERL_THRIFT}"
    exit 1
fi

if ! [ -d gen-erl ]; then
  ../../compiler/cpp/thrift -r --gen erl ../tutorial.thrift
fi


erlc -I ${ERL_THRIFT}/include -I ${ERL_THRIFT}/ebin \
     -I gen-erl -o gen-erl gen-erl/*.erl &&
  erlc -I ${ERL_THRIFT}/include -I gen-erl *.erl &&
  erl +K true -pa ${ERL_THRIFT}/ebin -pa gen-erl
