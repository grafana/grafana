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

# invoke Thrift comnpiler
thrift -r -gen haxe  ../../../test/ThriftTest.thrift
thrift -r -gen haxe  ../../../contrib/async-test/aggr.thrift
thrift -r -gen haxe  ../../../lib/rb/benchmark/Benchmark.thrift

# output folder
if [ ! -d bin ]; then
  mkdir  bin
fi

# invoke Haxe compiler
for target in *.hxml; do 
  echo --------------------------
  echo Building ${target} ...
  echo --------------------------
  if [ ! -d bin/${target} ]; then
    mkdir  bin/${target}
  fi
  haxe  --cwd .  ${target} 
done


#eof
