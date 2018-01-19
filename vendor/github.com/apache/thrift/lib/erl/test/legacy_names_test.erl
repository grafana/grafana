%%
%% Licensed to the Apache Software Foundation (ASF) under one
%% or more contributor license agreements. See the NOTICE file
%% distributed with this work for additional information
%% regarding copyright ownership. The ASF licenses this file
%% to you under the Apache License, Version 2.0 (the
%% "License"); you may not use this file except in compliance
%% with the License. You may obtain a copy of the License at
%%
%%   http://www.apache.org/licenses/LICENSE-2.0
%%
%% Unless required by applicable law or agreed to in writing,
%% software distributed under the License is distributed on an
%% "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
%% KIND, either express or implied. See the License for the
%% specific language governing permissions and limitations
%% under the License.
%%

-module(legacy_names_test).
-compile(export_all).

-include_lib("eunit/include/eunit.hrl").

-include("gen-erl/legacyNames_constants.hrl").

record_generation_test_() ->
  [
    {"capitalizedStruct record", ?_assertMatch(
      {capitalizedStruct, _, _},
      #capitalizedStruct{id=null,message=null}
    )}
  ].

struct_info_test_() ->
  [
    {"capitalizedStruct extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, i32, 'id', undefined},
        {2, undefined, string, 'message', undefined}
      ]},
      legacyNames_types:struct_info_ext(capitalizedStruct)
    )},
    {"listCapitalizedStructs extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, {struct, {'legacyNames_types', 'capitalizedStruct'}}}, 'structs', []}
      ]},
      legacyNames_types:struct_info_ext(listCapitalizedStructs)
    )}
  ].

service_info_test_() ->
  [
    {"names params", ?_assertEqual(
      {struct, [
        {1, {struct, {'legacyNames_types', 'capitalizedStruct'}}},
        {2, {struct, {'legacyNames_types', 'capitalizedStruct'}}}
      ]},
      legacyNames_thrift:function_info(names, params_type)
    )},
    {"names reply", ?_assertEqual(
      {struct, {'legacyNames_types', 'listCapitalizedStructs'}},
      legacyNames_thrift:function_info(names, reply_type)
    )},
    {"names exceptions", ?_assertEqual(
      {struct, [{1, {struct, {'legacyNames_types', 'xception'}}}]},
      legacyNames_thrift:function_info(names, exceptions)
    )}
  ].
