#!/bin/bash

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

rm -rf gen-py
../../../compiler/cpp/thrift --gen py test1.thrift || exit 1
../../../compiler/cpp/thrift --gen py test2.thrift || exit 1
../../../compiler/cpp/thrift --gen py test3.thrift && exit 1  # Fail since test3.thrift has python keywords
PYTHONPATH=./gen-py python -c 'import foo.bar.baz' || exit 1
PYTHONPATH=./gen-py python -c 'import test2' || exit 1
PYTHONPATH=./gen-py python -c 'import test1' &>/dev/null && exit 1  # Should fail.
cp -r gen-py simple
../../../compiler/cpp/thrift -r --gen py test2.thrift || exit 1
PYTHONPATH=./gen-py python -c 'import test2' || exit 1
diff -ur simple gen-py > thediffs
file thediffs | grep -s -q empty || exit 1
rm -rf simple thediffs
echo 'All tests pass!'
