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

-module(thrift_memory_buffer).

-behaviour(thrift_transport).

%% constructors
-export([new/0, new/1]).
%% protocol callbacks
-export([read/2, write/2, flush/1, close/1]).
%% legacy api
-export([new_transport_factory/0]).


%% wrapper around thrift_membuffer_transport for legacy reasons

new() -> thrift_membuffer_transport:new().

new(State) -> thrift_membuffer_transport:new(State).

new_transport_factory() -> {ok, fun() -> new() end}.

write(State, Data) -> thrift_membuffer_transport:write(State, Data).

read(State, Data) -> thrift_membuffer_transport:read(State, Data).

flush(State) -> thrift_membuffer_transport:flush(State).

close(State) -> thrift_membuffer_transport:close(State).

