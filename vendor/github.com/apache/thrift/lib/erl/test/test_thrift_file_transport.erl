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

-module(test_thrift_file_transport).
-include_lib("eunit/include/eunit.hrl").


new(File) -> thrift_file_transport:new(File).
new(File, Opts) -> thrift_file_transport:new(File, Opts).

new_test_() ->
  [
    {"new file", ?_assertMatch(
      {ok, {_, thrift_file_transport, {t_file, a_fake_file, true, write}}},
      new(a_fake_file)
    )},
    {"new file in read mode", ?_assertMatch(
      {ok, {_, thrift_file_transport, {t_file, a_fake_file, true, read}}},
      new(a_fake_file, [{mode, read}])
    )},
    {"new file in write mode", ?_assertMatch(
      {ok, {_, thrift_file_transport, {t_file, a_fake_file, true, write}}},
      new(a_fake_file, [{mode, write}])
    )},
    {"new file in should_close true mode", ?_assertMatch(
      {ok, {_, thrift_file_transport, {t_file, a_fake_file, true, write}}},
      new(a_fake_file, [{should_close, true}])
    )},
    {"new file in should_close false mode", ?_assertMatch(
      {ok, {_, thrift_file_transport, {t_file, a_fake_file, false, write}}},
      new(a_fake_file, [{should_close, false}])
    )}
  ].


read(File, Bytes) -> thrift_file_transport:read(File, Bytes).

read_test_() ->
  {setup,
    fun() ->
      meck:new(file, [unstick, passthrough]),
      meck:expect(file, read, fun(Bin, N) ->
        {Result, _} = split_binary(Bin, min(iolist_size(Bin), N)),
        {ok, Result}
      end)
    end,
    fun(_) -> meck:unload(file) end,
    [
      {"read zero bytes from empty file", ?_assertMatch(
        {_, {ok, <<>>}},
        read({t_file, <<>>, true, read}, 0)
      )},
      {"read 1 byte from empty file", ?_assertMatch(
        {_, {ok, <<>>}},
        read({t_file, <<>>, true, read}, 1)
      )},
      {"read zero bytes from nonempty file", ?_assertMatch(
        {_, {ok, <<>>}},
        read({t_file, <<"hallo world">>, true, read}, 0)
      )},
      {"read 1 byte from nonempty file", ?_assertMatch(
        {_, {ok, <<"h">>}},
        read({t_file, <<"hallo world">>, true, read}, 1)
      )},
      {"read a zillion bytes from nonempty file", ?_assertMatch(
        {_, {ok, <<"hallo world">>}},
        read({t_file, <<"hallo world">>, true, read}, 65536)
      )},
      {"read 0 byte from file in write mode", ?_assertMatch(
        {_, {error, write_mode}},
        read({t_file, <<>>, true, write}, 0)
      )},
      {"read 1 byte from file in write mode", ?_assertMatch(
        {_, {error, write_mode}},
        read({t_file, <<>>, true, write}, 1)
      )}
    ]
  }.


read_exact(File, Bytes) -> thrift_file_transport:read_exact(File, Bytes).

read_exact_test_() ->
  {setup,
    fun() ->
      meck:new(file, [unstick, passthrough]),
      meck:expect(file, read, fun(Bin, N) ->
        {Result, _} = split_binary(Bin, min(iolist_size(Bin), N)),
        {ok, Result}
      end)
    end,
    fun(_) -> meck:unload(file) end,
    [
      {"read exactly zero bytes from empty file", ?_assertMatch(
        {_, {ok, <<>>}},
        read_exact({t_file, <<>>, true, read}, 0)
      )},
      {"read exactly 1 byte from empty file", ?_assertMatch(
        {_, {error, eof}},
        read_exact({t_file, <<>>, true, read}, 1)
      )},
      {"read exactly zero bytes from nonempty file", ?_assertMatch(
        {_, {ok, <<>>}},
        read_exact({t_file, <<"hallo world">>, true, read}, 0)
      )},
      {"read exactly 1 byte from nonempty file", ?_assertMatch(
        {_, {ok, <<"h">>}},
        read_exact({t_file, <<"hallo world">>, true, read}, 1)
      )},
      {"read exactly a zillion bytes from nonempty file", ?_assertMatch(
        {_, {error, eof}},
        read_exact({t_file, <<"hallo world">>, true, read}, 65536)
      )},
      {"read exactly 0 byte from file in write mode", ?_assertMatch(
        {_, {error, write_mode}},
        read_exact({t_file, <<>>, true, write}, 0)
      )},
      {"read exactly 1 byte from file in write mode", ?_assertMatch(
        {_, {error, write_mode}},
        read_exact({t_file, <<>>, true, write}, 1)
      )}
    ]
  }.


write(File, Data) -> thrift_file_transport:write(File, Data).

write_test_() ->
  {setup,
    fun() ->
      meck:new(file, [unstick, passthrough]),
      meck:expect(file, write, fun(_, _) -> ok end)
    end,
    fun(_) -> meck:unload(file) end,
    [
      {"write empty list to file", ?_assertMatch(
        {{t_file, a_fake_file, true, write}, ok},
        write({t_file, a_fake_file, true, write}, [])
      )},
      {"write empty binary to file", ?_assertMatch(
        {{t_file, a_fake_file, true, write}, ok},
        write({t_file, a_fake_file, true, write}, <<>>)
      )},
      {"write a list to file", ?_assertMatch(
        {{t_file, a_fake_file, true, write}, ok},
        write({t_file, a_fake_file, true, write}, "hallo world")
      )},
      {"write a binary to file", ?_assertMatch(
        {{t_file, a_fake_file, true, write}, ok},
        write({t_file, a_fake_file, true, write}, <<"hallo world">>)
      )},
      {"write a binary to file in read mode", ?_assertMatch(
        {_, {error, read_mode}},
        write({t_file, a_fake_file, true, read}, <<"hallo world">>)
      )},
      {"write a list to file in read mode", ?_assertMatch(
        {_, {error, read_mode}},
        write({t_file, a_fake_file, true, read}, "hallo world")
      )}
    ]
  }.


flush(Transport) -> thrift_file_transport:flush(Transport).

flush_test_() ->
  {setup,
    fun() ->
      meck:new(file, [unstick, passthrough]),
      meck:expect(file, sync, fun(_File) -> ok end)
    end,
    fun(_) -> meck:unload(file) end,
    [
      {"flush file", ?_assertMatch(
        {{t_file, a_fake_file, true, write}, ok},
        flush({t_file, a_fake_file, true, write})
      )}
    ]
  }.


close(Transport) -> thrift_file_transport:close(Transport).

close_test_() ->
  {setup,
    fun() ->
      meck:new(file, [unstick, passthrough]),
      meck:expect(file, close, fun(_) -> ok end)
    end,
    fun(_) -> meck:unload(file) end,
    [
      {"close file", ?_assertMatch(
        {{t_file, a_fake_file, true, write}, ok},
        close({t_file, a_fake_file, true, write})
      )}
    ]
  }.