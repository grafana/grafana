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

-module(thrift_multiplexed_protocol).

-behaviour(thrift_protocol).

-include("thrift_constants.hrl").
-include("thrift_protocol.hrl").

-include("thrift_protocol_behaviour.hrl").

-export([new/2,
         read/2,
         write/2,
         flush_transport/1,
         close_transport/1
        ]).

-record(protocol, {module, data}).
-type protocol() :: #protocol{}.

-record (multiplexed_protocol, {protocol_module_to_decorate::atom(),
								protocol_data_to_decorate::term(),
								service_name::nonempty_string()}).

-type state() :: #multiplexed_protocol{}.

-spec new(ProtocolToDecorate::protocol(), ServiceName::nonempty_string()) -> {ok, Protocol::protocol()}.
new(ProtocolToDecorate, ServiceName) when is_record(ProtocolToDecorate, protocol),
                                          is_list(ServiceName) ->
    State = #multiplexed_protocol{protocol_module_to_decorate = ProtocolToDecorate#protocol.module,
                                    protocol_data_to_decorate = ProtocolToDecorate#protocol.data,
                                                 service_name = ServiceName},
    thrift_protocol:new(?MODULE, State).

flush_transport(State = #multiplexed_protocol{protocol_module_to_decorate = ProtocolModuleToDecorate,
                                                protocol_data_to_decorate = State0}) ->
    {State1, ok} = ProtocolModuleToDecorate:flush_transport(State0),
    {State#multiplexed_protocol{protocol_data_to_decorate = State1}, ok}.

close_transport(State = #multiplexed_protocol{protocol_module_to_decorate = ProtocolModuleToDecorate,
                                                protocol_data_to_decorate = State0}) ->
    {State1, ok} = ProtocolModuleToDecorate:close_transport(State0),
    {State#multiplexed_protocol{protocol_data_to_decorate = State1}, ok}.

write(State = #multiplexed_protocol{protocol_module_to_decorate = ProtocolModuleToDecorate,
                                      protocol_data_to_decorate = State0,
                                                   service_name = ServiceName},
      Message = #protocol_message_begin{name = Name}) ->
    {State1, ok} = ProtocolModuleToDecorate:write(State0,
                                                  Message#protocol_message_begin{name=ServiceName ++
                                                                                      ?MULTIPLEXED_SERVICE_SEPARATOR ++
                                                                                      Name}),
    {State#multiplexed_protocol{protocol_data_to_decorate = State1}, ok};

write(State = #multiplexed_protocol{protocol_module_to_decorate = ProtocolModuleToDecorate,
                                      protocol_data_to_decorate = State0},
      Message) ->
    {State1, ok} = ProtocolModuleToDecorate:write(State0, Message),
    {State#multiplexed_protocol{protocol_data_to_decorate = State1}, ok}.

read(State = #multiplexed_protocol{protocol_module_to_decorate = ProtocolModuleToDecorate,
                                     protocol_data_to_decorate = State0},
     Message) ->
    {State1, Result} = ProtocolModuleToDecorate:read(State0, Message),
    {State#multiplexed_protocol{protocol_data_to_decorate = State1}, Result}.
