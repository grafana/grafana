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

-module(test_thrift_buffered_transport).
-include_lib("eunit/include/eunit.hrl").


new(Transport) -> thrift_buffered_transport:new(Transport).

new_test_() ->
  [
    {"new buffered membuffer", ?_assertMatch(
      {ok, {t_transport, thrift_buffered_transport, {t_buffered,
        {t_transport, thrift_membuffer_transport, {t_membuffer, []}},
        []
      }}},
      new({t_transport, thrift_membuffer_transport, {t_membuffer, []}})
    )}
  ].


read(Frame, Bytes) -> thrift_buffered_transport:read(Frame, Bytes).

read_test_() ->
  [
    {"read zero bytes from an empty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        {ok, <<>>}
      },
      read(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        0
      )
    )},
    {"read 1 byte from an empty buffered membuffer", ?_assertMatch(
      {_, {ok, <<>>}},
      read(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        1
      )
    )},
    {"read zero bytes from nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer,
            <<"hallo world">>
          }},
          []
        },
        {ok, <<>>}
      },
      read(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer,
            <<"hallo world">>
          }},
          []
        },
        0
      )
    )},
    {"read 1 byte from nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"allo world">>}},
          []
        },
        {ok, <<"h">>}
      },
      read(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"hallo world">>}},
          []
        },
        1
      )
    )},
    {"read 1 byte from nonempty buffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"allo world">>}},
          []
        },
        {ok, <<"h">>}
      },
      read(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"hallo world">>}},
          []
        },
        1
      )
    )},
    {"read a zillion bytes from nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        {ok, <<"hallo world">>}
      },
      read(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"hallo world">>}},
          []
        },
        65536
      )
    )}
  ].


read_exact(Frame, Bytes) -> thrift_buffered_transport:read_exact(Frame, Bytes).

read_exact_test_() ->
  [
    {"read exactly zero bytes from an empty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        {ok, <<>>}
      },
      read_exact(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        0
      )
    )},
    {"read exactly 1 byte from an empty buffered membuffer", ?_assertMatch(
      {_, {error, eof}},
      read_exact(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        1
      )
    )},
    {"read exactly zero bytes from nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"hallo world">>}},
          []
        },
        {ok, <<>>}
      },
      read_exact(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"hallo world">>}},
          []
        },
        0
      )
    )},
    {"read exactly 1 byte from nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"allo world">>}},
          []
        },
        {ok, <<"h">>}
      },
      read_exact(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer,
            <<"hallo world">>
          }},
          []
        },
        1
      )
    )},
    {"read exactly 1 byte from nonempty buffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"allo world">>}},
          []
        },
        {ok, <<"h">>}
      },
      read_exact(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"hallo world">>}},
          []
        },
        1
      )
    )},
    {"read exactly a zillion bytes from nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<"hallo world">>}},
          []
        },
        {error, eof}
      },
      read_exact(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer,
            <<"hallo world">>
          }},
          []
        },
        65536
      )
    )}
  ].


write(Framed, Data) -> thrift_buffered_transport:write(Framed, Data).

write_test_() ->
  [
    {"write empty list to empty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          [[], []]
        },
        ok
      },
      write(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        []
      )
    )},
    {"write empty list to nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          [["hallo world"], []]
        },
        ok
      },
      write(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          ["hallo world"]
        },
        []
      )
    )},
    {"write empty binary to empty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          [[], <<>>]
        },
        ok
      },
      write(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        <<>>
      )
    )},
    {"write empty binary to nonempty buffered membuffer", ?_assertMatch(
      {
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          [["hallo world"], <<>>]
        },
        ok
      },
      write(
        {t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          ["hallo world"]
        },
        <<>>
      )
    )}
  ].


flush(Transport) -> thrift_buffered_transport:flush(Transport).

flush_test_() ->
  [
    {"flush empty buffered membuffer", ?_assertMatch(
      {{t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
          []
        },
        ok
      },
      flush({t_buffered,
        {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
        []
      })
    )},
    {"flush nonempty buffered membuffer", ?_assertMatch(
      {{t_buffered,
          {t_transport, thrift_membuffer_transport, {t_membuffer,
            [<<>>, <<"hallo world">>]
          }},
          []
        },
        ok
      },
      flush({t_buffered,
        {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
        <<"hallo world">>
      })
    )}
  ].


close(Transport) -> thrift_buffered_transport:close(Transport).

close_test_() ->
  {"close buffered membuffer", ?_assertMatch(
    {{t_buffered,
        {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
        []
      },
      ok
    },
    close({t_buffered,
      {t_transport, thrift_membuffer_transport, {t_membuffer, <<>>}},
      []
    })
  )}.

