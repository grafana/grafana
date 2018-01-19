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

-module(test_thrift_socket_transport).
-include_lib("eunit/include/eunit.hrl").


new(Socket) -> thrift_socket_transport:new(Socket).
new(Socket, Opts) -> thrift_socket_transport:new(Socket, Opts).

new_test_() ->
  [
    {"new socket", ?_assertMatch(
      {ok, {_, thrift_socket_transport, {t_socket, a_fake_socket, 60000, []}}},
      new(a_fake_socket)
    )},
    {"new socket with no options", ?_assertMatch(
      {ok, {_, thrift_socket_transport, {t_socket, a_fake_socket, 60000, []}}},
      new(a_fake_socket, [])
    )},
    {"new socket with integer timeout", ?_assertMatch(
      {ok, {_, thrift_socket_transport, {t_socket, a_fake_socket, 5000, []}}},
      new(a_fake_socket, [{recv_timeout, 5000}])
    )},
    {"new socket with infinity timeout", ?_assertMatch(
      {ok, {_, thrift_socket_transport, {t_socket, a_fake_socket, infinity, []}}},
      new(a_fake_socket, [{recv_timeout, infinity}])
    )}
  ].


read(Socket, Bytes) -> thrift_socket_transport:read(Socket, Bytes).

read_test_() ->
  {setup,
    fun() ->
      meck:new(gen_tcp, [unstick, passthrough]),
      meck:expect(gen_tcp, recv, fun(Bin, 0, _) -> {ok, Bin} end)
    end,
    fun(_) -> meck:unload(gen_tcp) end,
    [
      {"read zero bytes from empty socket", ?_assertMatch(
        {_, {ok, <<>>}},
        read({t_socket, <<>>, 60000, []}, 0)
      )},
      {"read 1 byte from empty socket", ?_assertMatch(
        {_, {ok, <<>>}},
        read({t_socket, <<>>, 60000, []}, 1)
      )},
      {"read zero bytes from nonempty socket", ?_assertMatch(
        {{t_socket, _, _, _}, {ok, <<>>}},
        read({t_socket, <<"hallo world">>, 60000, []}, 0)
      )},
      {"read 1 byte from nonempty socket", ?_assertMatch(
        {{t_socket, _, _, <<"allo world">>}, {ok, <<"h">>}},
        read({t_socket, <<"hallo world">>, 60000, []}, 1)
      )},
      {"read a zillion bytes from nonempty socket", ?_assertMatch(
        {{t_socket, _, _, <<>>}, {ok, <<"hallo world">>}},
        read({t_socket, <<"hallo world">>, 60000, []}, 65536)
      )},
      {"read 1 byte from previously buffered socket", ?_assertMatch(
        {{t_socket, _, _, <<"allo">>}, {ok, <<"h">>}},
        read({t_socket, <<" world">>, 60000, <<"hallo">>}, 1)
      )},
      {"read 6 byte from previously buffered socket", ?_assertMatch(
        {{t_socket, _, _, <<"world">>}, {ok, <<"hallo ">>}},
        read({t_socket, <<" world">>, 60000, <<"hallo">>}, 6)
      )},
      {"read a zillion bytes from previously buffered socket", ?_assertMatch(
        {{t_socket, _, _, <<>>}, {ok, <<"hallo world">>}},
        read({t_socket, <<" world">>, 60000, <<"hallo">>}, 65536)
      )}
    ]
  }.


read_exact(Socket, Bytes) -> thrift_socket_transport:read_exact(Socket, Bytes).

read_exact_test_() ->
  {setup,
    fun() ->
      meck:new(gen_tcp, [unstick, passthrough]),
      meck:expect(gen_tcp, recv, fun(Bin, N, _) ->
        case N of
          0 -> {ok, Bin};
          1 -> {ok, <<"h">>};
          N when N > 2 -> {error, timeout}
        end
      end),
      meck:expect(gen_tcp, close, fun(_) -> ok end)
    end,
    fun(_) -> meck:unload(gen_tcp) end,
    [
      {"read_exact zero bytes from empty socket", ?_assertMatch(
        {_, {ok, <<>>}},
        read_exact({t_socket, <<>>, 60000, []}, 0)
      )},
      {"read_exact zero bytes from nonempty socket", ?_assertMatch(
        {{t_socket, _, _, _}, {ok, <<>>}},
        read_exact({t_socket, <<"hallo world">>, 60000, []}, 0)
      )},
      {"read_exact 1 byte from nonempty socket", ?_assertMatch(
        {{t_socket, _, _, []}, {ok, <<"h">>}},
        read_exact({t_socket, <<"hallo world">>, 60000, []}, 1)
      )},
      {"read_exact a zillion bytes from nonempty socket", ?_assertMatch(
        {{t_socket, _, _, []}, {error, timeout}},
        read_exact({t_socket, <<"hallo world">>, 60000, []}, 65536)
      )},
      {"read_exact 1 byte from previously buffered socket", ?_assertMatch(
        {{t_socket, _, _, <<"allo">>}, {ok, <<"h">>}},
        read_exact({t_socket, <<" world">>, 60000, <<"hallo">>}, 1)
      )},
      {"read_exact 6 byte from previously buffered socket", ?_assertMatch(
        {{t_socket, _, _, []}, {ok, <<"more h">>}},
        read_exact({t_socket, <<"hallo">>, 60000, <<"more ">>}, 6)
      )},
      {"read_exact a zillion bytes from previously buffered socket", ?_assertMatch(
        {{t_socket, _, _, <<"hallo">>}, {error, timeout}},
        read_exact({t_socket, <<" world">>, 60000, <<"hallo">>}, 65536)
      )}
    ]
  }.


write(Socket, Data) -> thrift_socket_transport:write(Socket, Data).

write_test_() ->
  {setup,
    fun() ->
      meck:new(gen_tcp, [unstick, passthrough]),
      meck:expect(gen_tcp, send, fun(_, _) -> ok end)
    end,
    fun(_) -> meck:unload(gen_tcp) end,
    [
      {"write empty list to socket", ?_assertMatch(
        {{t_socket, a_fake_socket, 60000, []}, ok},
        write({t_socket, a_fake_socket, 60000, []}, [])
      )},
      {"write empty binary to socket", ?_assertMatch(
        {{t_socket, a_fake_socket, 60000, []}, ok},
        write({t_socket, a_fake_socket, 60000, []}, <<>>)
      )},
      {"write a list to socket", ?_assertMatch(
        {{t_socket, a_fake_socket, 60000, []}, ok},
        write({t_socket, a_fake_socket, 60000, []}, "hallo world")
      )},
      {"write a binary to socket", ?_assertMatch(
        {{t_socket, a_fake_socket, 60000, []}, ok},
        write({t_socket, a_fake_socket, 60000, []}, <<"hallo world">>)
      )}
    ]
  }.


flush(Transport) -> thrift_socket_transport:flush(Transport).

flush_test_() ->
  [
    {"flush socket", ?_assertMatch(
      {{t_socket, a_fake_socket, 60000, []}, ok},
      flush({t_socket, a_fake_socket, 60000, []})
    )}
  ].


close(Transport) -> thrift_socket_transport:close(Transport).

close_test_() ->
  {setup,
    fun() ->
      meck:new(gen_tcp, [unstick, passthrough]),
      meck:expect(gen_tcp, close, fun(_) -> ok end)
    end,
    fun(_) -> meck:unload(gen_tcp) end,
    [
      {"close membuffer", ?_assertMatch(
        {{t_socket, a_fake_socket, 60000, []}, ok},
        close({t_socket, a_fake_socket, 60000, []})
      )}
    ]
  }.