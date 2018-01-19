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

-module(stress_server).


-export([start_link/1,

         handle_function/2,

         echoVoid/0,
         echoByte/1,
         echoI32/1,
         echoI64/1,
         echoString/1,
         echoList/1,
         echoSet/1,
         echoMap/1
        ]).

start_link(Port) ->
    thrift_server:start_link(Port, service_thrift, ?MODULE).


handle_function(Function, Args) ->
    case apply(?MODULE, Function, tuple_to_list(Args)) of
        ok ->
             ok;
        Else -> {reply, Else}
    end.


echoVoid() ->
    ok.
echoByte(X) ->
    X.
echoI32(X) ->
    X.
echoI64(X) ->
    X.
echoString(X) ->
    X.
echoList(X) ->
    X.
echoSet(X) ->
    X.
echoMap(X) ->
    X.
