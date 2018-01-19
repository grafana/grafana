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

-module(test_disklog).

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

disklog_test() ->
  {ok, TransportFactory} =
    thrift_disk_log_transport:new_transport_factory(
      test_disklog,
      [{file, "./test_log"},
       {size, {1024*1024, 10}}]),
  {ok, ProtocolFactory} =
    thrift_binary_protocol:new_protocol_factory( TransportFactory, []),
  {ok, Proto} = ProtocolFactory(),
  {ok, Client0} = thrift_client:new(Proto, thrift_test_thrift),

  io:format("Client started~n"),

  % We have to make oneway calls into this client only since otherwise it
  % will try to read from the disklog and go boom.
  {Client1, {ok, ok}} = thrift_client:call(Client0, testOneway, [16#deadbeef]),
  io:format("Call written~n"),

  % Use the send_call method to write a non-oneway call into the log
  {Client2, ok} =
    thrift_client:send_call(Client1, testString, [<<"hello world">>]),
  io:format("Non-oneway call sent~n"),

  {_Client3, ok} = thrift_client:close(Client2),
  io:format("Client closed~n"),
  
  lists:foreach(fun(File) -> file:delete(File) end, [
    "./test_log.1",
    "./test_log.idx",
    "./test_log.siz"
  ]),
  io:format("Cleaning up test files~n"),

  ok.

disklog_base64_test() ->
  {ok, TransportFactory} =
    thrift_disk_log_transport:new_transport_factory(
      test_disklog,
      [{file, "./test_b64_log"},
       {size, {1024*1024, 10}}]),
  {ok, B64Factory} =
    thrift_base64_transport:new_transport_factory(TransportFactory),
  {ok, BufFactory} =
    thrift_buffered_transport:new_transport_factory(B64Factory),
  {ok, ProtocolFactory} =
    thrift_binary_protocol:new_protocol_factory(BufFactory, []),
  {ok, Proto} = ProtocolFactory(),
  {ok, Client0} = thrift_client:new(Proto, thrift_test_thrift),

  io:format("Client started~n"),

  % We have to make oneway calls into this client only since otherwise
  % it will try to read from the disklog and go boom.
  {Client1, {ok, ok}} = thrift_client:call(Client0, testOneway, [16#deadbeef]),
  io:format("Call written~n"),

  % Use the send_call method to write a non-oneway call into the log
  {Client2, ok} =
    thrift_client:send_call(Client1, testString, [<<"hello world">>]),
  io:format("Non-oneway call sent~n"),

  {_Client3, ok} = thrift_client:close(Client2),
  io:format("Client closed~n"),

  lists:foreach(fun(File) -> file:delete(File) end, [
    "./test_b64_log.1",
    "./test_b64_log.idx",
    "./test_b64_log.siz"
  ]),
  io:format("Cleaning up test files~n"),

  ok.

-endif.
