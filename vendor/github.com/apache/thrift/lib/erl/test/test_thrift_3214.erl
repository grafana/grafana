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

-module(test_thrift_3214).
-compile(export_all).

-include("gen-erl/thrift3214_types.hrl").

-ifdef(TEST).
-ifndef(otp16_or_less).
-include_lib("eunit/include/eunit.hrl").

record_generation_test_() ->
  [
    {"StringMap record", ?_assertMatch(
      {'StringMap', _},
      #'StringMap'{data=#{50 => "foo"}}
    )},
    {"StringMap record defaults", ?_assertEqual(
      {'StringMap', #{1 => "a", 2 => "b"}},
      #'StringMap'{}
    )},
    {"StringMap record dict from list", ?_assertNotEqual(
      {'StringMap', dict:from_list([{1, "a"}, {2, "b"}])},
      #'StringMap'{}
    )},
    {"StringMap record map from list", ?_assertEqual(
      {'StringMap', maps:from_list([{1, "a"}, {2, "b"}])},
      #'StringMap'{}
    )}
  ].

struct_info_test_() ->
  [
    {"StringMap extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, {map, i32, string}, 'data', #{1 => "a", 2 => "b"}}
      ]},
      thrift3214_types:struct_info_ext('StringMap')
    )}
  ].

-endif.
-endif.
