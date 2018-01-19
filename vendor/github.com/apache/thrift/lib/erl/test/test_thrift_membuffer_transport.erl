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

-module(test_thrift_membuffer_transport).
-include_lib("eunit/include/eunit.hrl").


new() -> thrift_membuffer_transport:new().
new(Data) -> thrift_membuffer_transport:new(Data).

new_test_() ->
  [
    {"new empty membuffer", ?_assertMatch(
      {ok, {_, _, {t_membuffer, []}}},
      new()
    )},
    {"new membuffer with <<>>", ?_assertMatch(
      {ok, {_, _, {t_membuffer, [<<>>]}}},
      new(<<>>)
    )},
    {"new membuffer with []", ?_assertMatch(
      {ok, {_, _, {t_membuffer, []}}},
      new([])
    )},
    {"new membuffer with <<\"hallo world\">>", ?_assertMatch(
      {ok, {_, _, {t_membuffer, [<<"hallo world">>]}}},
      new(<<"hallo world">>)
    )},
    {"new membuffer with \"hallo world\"", ?_assertMatch(
      {ok, {_, _, {t_membuffer, "hallo world"}}},
      new("hallo world")
    )}
  ].


read(Membuffer, Bytes) -> thrift_membuffer_transport:read(Membuffer, Bytes).

read_test_() ->
  [
    {"read zero bytes from an empty membuffer", ?_assertMatch(
      {_, {ok, <<>>}},
      read({t_membuffer, []}, 0)
    )},
    {"read 1 byte from an empty membuffer", ?_assertMatch(
      {_, {ok, <<>>}},
      read({t_membuffer, []}, 1)
    )},
    {"read zero bytes from nonempty membuffer", ?_assertMatch(
      {{t_membuffer, <<"hallo world">>}, {ok, <<>>}},
      read({t_membuffer, [["hallo", " "], "world"]}, 0)
    )},
    {"read 1 byte from nonempty membuffer", ?_assertMatch(
      {{t_membuffer, <<"allo world">>}, {ok, <<"h">>}},
      read({t_membuffer, [["hallo", " "], "world"]}, 1)
    )},
    {"read a zillion bytes from nonempty buffer", ?_assertMatch(
      {{t_membuffer, <<>>}, {ok, <<"hallo world">>}},
      read({t_membuffer, [["hallo", " "], "world"]}, 65536)
    )}
  ].


read_exact(Membuffer, Bytes) ->
  thrift_membuffer_transport:read_exact(Membuffer, Bytes).

read_exact_test_() ->
  [
    {"read exactly zero bytes from an empty membuffer", ?_assertMatch(
      {_, {ok, <<>>}},
      read_exact({t_membuffer, []}, 0)
    )},
    {"read exactly 1 byte from an empty membuffer", ?_assertMatch(
      {_, {error, eof}},
      read_exact({t_membuffer, []}, 1)
    )},
    {"read exactly zero bytes from nonempty membuffer", ?_assertMatch(
      {{t_membuffer, <<"hallo world">>}, {ok, <<>>}},
      read_exact({t_membuffer, [["hallo", " "], "world"]}, 0)
    )},
    {"read exactly 1 byte from nonempty membuffer", ?_assertMatch(
      {{t_membuffer, <<"allo world">>}, {ok, <<"h">>}},
      read_exact({t_membuffer, [["hallo", " "], "world"]}, 1)
    )},
    {"read exactly a zillion bytes from nonempty buffer", ?_assertMatch(
      {{t_membuffer, [["hallo", " "], "world"]}, {error, eof}},
      read_exact({t_membuffer, [["hallo", " "], "world"]}, 65536)
    )}
  ].


write(Membuffer, Data) -> thrift_membuffer_transport:write(Membuffer, Data).

write_test_() ->
  [
    {"write empty list to empty membuffer", ?_assertMatch(
      {{t_membuffer, [[], []]}, ok},
      write({t_membuffer, []}, [])
    )},
    {"write empty list to nonempty membuffer", ?_assertMatch(
      {{t_membuffer, ["hallo world", []]}, ok},
      write({t_membuffer, "hallo world"}, [])
    )},
    {"write empty binary to empty membuffer", ?_assertMatch(
      {{t_membuffer, [[], <<>>]}, ok},
      write({t_membuffer, []}, <<>>)
    )},
    {"write empty binary to nonempty membuffer", ?_assertMatch(
      {{t_membuffer, ["hallo world", <<>>]}, ok},
      write({t_membuffer, "hallo world"}, <<>>)
    )},
    {"write a list to empty membuffer", ?_assertMatch(
      {{t_membuffer, [[], "hallo world"]}, ok},
      write({t_membuffer, []}, "hallo world")
    )},
    {"write a list to nonempty membuffer", ?_assertMatch(
      {{t_membuffer, [["hallo", " "], "world"]}, ok},
      write({t_membuffer, ["hallo", " "]}, "world")
    )},
    {"write a binary to empty membuffer", ?_assertMatch(
      {{t_membuffer, [[], <<"hallo world">>]}, ok},
      write({t_membuffer, []}, <<"hallo world">>)
    )},
    {"write a binary to nonempty membuffer", ?_assertMatch(
      {{t_membuffer, [["hallo", " "], <<"world">>]}, ok},
      write({t_membuffer, ["hallo", " "]}, <<"world">>)
    )}
  ].


flush(Transport) -> thrift_membuffer_transport:flush(Transport).

flush_test_() ->
  [
    {"flush empty membuffer", ?_assertMatch(
      {{t_membuffer, []}, ok},
      flush({t_membuffer, []})
    )},
    {"flush nonempty membuffer", ?_assertMatch(
      {{t_membuffer, [<<"hallo world">>]}, ok},
      flush({t_membuffer, [<<"hallo world">>]})
    )}
  ].


close(Transport) -> thrift_membuffer_transport:close(Transport).

close_test_() ->
  {"close membuffer", ?_assertMatch(
    {{t_membuffer, _}, ok},
    close({t_membuffer, []})
  )}.