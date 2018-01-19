# Thrift Erlang Software Library #

## License ##

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

## Release Notes ##

### 0.9.2 ###

as of 0.9.2 struct and function naming conventions have changed. to retain the
old naming conventions (for backwards compatibility) use the compiler option
`legacynames`

## Example ##

Example session using thrift_client:

```erl
1> {ok, C0} = thrift_client_util:new("localhost", 9090, thrift_test_thrift, []), ok.
ok
2> {C1, R1} = thrift_client:call(C0, testVoid, []), R1.
{ok,ok}
3> {C2, R2} = thrift_client:call(C1, testVoid, [asdf]), R2.
{error,{bad_args,testVoid,[asdf]}}
4> {C3, R3} = thrift_client:call(C2, testI32, [123]), R3.
{ok,123}
5> {C4, R4} = thrift_client:call(C3, testOneway, [1]), R4.
{ok,ok}
6> {C5, R5} = thrift_client:call(C4, testXception, ["foo"]), R5.
{error,{no_function,testXception}}
7> {C6, R6} = thrift_client:call(C5, testException, ["foo"]), R6.
{ok,ok}
8> {C7, R7} = (catch thrift_client:call(C6, testException, ["Xception"])), R7.
{exception,{xception,1001,<<"Xception">>}}
```
