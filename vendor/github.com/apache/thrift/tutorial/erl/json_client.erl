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
%% The JSON protocol over HTTP implementation was created by
%% Peter Neumark <neumark.peter@gmail.com> based on
%% the binary protocol + socket tutorial. Use with the same server
%% that the Javascript tutorial uses!

-module(json_client).

-include("calculator_thrift.hrl").

-export([t/0]).

%% Client constructor for the http transports
%% with the json protocol
new_client(Host, Path, Service, _Options) ->
    {ProtoOpts, TransOpts} = {[],[]},
    TransportFactory = fun() -> thrift_http_transport:new(Host, Path, TransOpts) end,
    {ok, ProtocolFactory} = thrift_json_protocol:new_protocol_factory(
                              TransportFactory, ProtoOpts),
    {ok, Protocol} = ProtocolFactory(),
    thrift_client:new(Protocol, Service).

p(X) ->
    io:format("~p~n", [X]),
    ok.

t() ->
    inets:start(),
    {ok, Client0} = new_client("127.0.0.1:8088", "/thrift/service/tutorial/",
                                           calculator_thrift,
                                           []),
    {Client1, {ok, ok}} = thrift_client:call(Client0, ping, []),
    io:format("ping~n", []),

    {Client2, {ok, Sum}} = thrift_client:call(Client1, add,  [1, 1]),
    io:format("1+1=~p~n", [Sum]),

    {Client3, {ok, Sum1}} = thrift_client:call(Client2, add, [1, 4]),
    io:format("1+4=~p~n", [Sum1]),

    Work = #work{op=?tutorial_Operation_SUBTRACT,
                 num1=15,
                 num2=10},
    {Client4, {ok, Diff}} = thrift_client:call(Client3, calculate, [1, Work]),
    io:format("15-10=~p~n", [Diff]),

    {Client5, {ok, Log}} = thrift_client:call(Client4, getStruct, [1]),
    io:format("Log: ~p~n", [Log]),

    Client6 =
        try
            Work1 = #work{op=?tutorial_Operation_DIVIDE,
                          num1=1,
                          num2=0},
            {ClientS1, {ok, _Quot}} = thrift_client:call(Client5, calculate, [2, Work1]),

            io:format("LAME: exception handling is broken~n", []),
            ClientS1
        catch
            throw:{ClientS2, Z} ->
                io:format("Got exception where expecting - the " ++
                          "following is NOT a problem!!!~n"),
                p(Z),
                ClientS2
        end,


    {Client7, {ok, ok}} = thrift_client:call(Client6, zip, []),
    io:format("zip~n", []),

    {_Client8, ok} = thrift_client:close(Client7),
    ok.
