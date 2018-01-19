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

-module(thrift_multiplexed_map_wrapper).

-export([
          new/0
         ,store/3
         ,find/2
         ,fetch/2
        ]).

-type service_handler()     :: nonempty_string().
-type module_()             :: atom().
-type service_handler_map() :: [{ServiceHandler::service_handler(), Module::module_()}].

-spec new() -> service_handler_map().
new() ->
    orddict:new().

-spec store(ServiceHandler, Module, Map) -> NewMap when
    ServiceHandler :: service_handler(),
    Module         :: module_(),
    Map            :: service_handler_map(),
    NewMap         :: service_handler_map().
store(ServiceHandler, Module, Map) ->
    orddict:store(ServiceHandler, Module, Map).

-spec find(ServiceHandler, Map) -> {ok, Module} | error when
    ServiceHandler :: service_handler(),
    Module         :: module_(),
    Map            :: service_handler_map().
find(ServiceHandler, Map) ->
    orddict:find(ServiceHandler, Map).

-spec fetch(ServiceHandler, Map) -> Module when
    ServiceHandler :: service_handler(),
    Module         :: module_(),
    Map            :: service_handler_map().
fetch(ServiceHandler, Map) ->
    orddict:fetch(ServiceHandler, Map).
