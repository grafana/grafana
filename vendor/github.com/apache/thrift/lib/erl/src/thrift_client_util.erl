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

-module(thrift_client_util).

-export([new/4]).
-export([new_multiplexed/3, new_multiplexed/4]).

-type service_name()            :: nonempty_string().
-type service_module()          :: atom().
-type multiplexed_service_map() :: [{ServiceName::service_name(), ServiceModule::service_module()}].

%%
%% Splits client options into client, protocol, and transport options
%%
%% split_options([Options...]) -> {ProtocolOptions, TransportOptions}
%%
split_options(Options) ->
    split_options(Options, [], []).

split_options([], ProtoIn, TransIn) ->
    {ProtoIn, TransIn};

split_options([Opt = {OptKey, _} | Rest], ProtoIn, TransIn)
  when OptKey =:= strict_read;
       OptKey =:= strict_write;
       OptKey =:= protocol ->
    split_options(Rest, [Opt | ProtoIn], TransIn);

split_options([Opt = {OptKey, _} | Rest], ProtoIn, TransIn)
  when OptKey =:= framed;
       OptKey =:= connect_timeout;
       OptKey =:= recv_timeout;
       OptKey =:= sockopts;
       OptKey =:= ssltransport;
       OptKey =:= ssloptions->
    split_options(Rest, ProtoIn, [Opt | TransIn]).


%% Client constructor for the common-case of socket transports
new(Host, Port, Service, Options)
  when is_integer(Port), is_atom(Service), is_list(Options) ->
    {ProtoOpts, TransOpts0} = split_options(Options),

    {TransportModule, TransOpts2} = case lists:keytake(ssltransport, 1, TransOpts0) of
                                        {value, {_, true}, TransOpts1} -> {thrift_sslsocket_transport, TransOpts1};
                                        false -> {thrift_socket_transport, TransOpts0}
                                    end,

    {ProtocolModule, ProtoOpts1} = case lists:keytake(protocol, 1, ProtoOpts) of
                                     {value, {_, compact}, Opts} -> {thrift_compact_protocol, Opts};
                                     {value, {_, json}, Opts} -> {thrift_json_protocol, Opts};
                                     {value, {_, binary}, Opts} -> {thrift_binary_protocol, Opts};
                                     false -> {thrift_binary_protocol, ProtoOpts}
                                   end,
    {ok, TransportFactory} =
        TransportModule:new_transport_factory(Host, Port, TransOpts2),

    {ok, ProtocolFactory} = ProtocolModule:new_protocol_factory(
                              TransportFactory, ProtoOpts1),

    case ProtocolFactory() of
        {ok, Protocol} ->
            thrift_client:new(Protocol, Service);
        {error, Error} ->
            {error, Error}
    end.

-spec new_multiplexed(Host, Port, Services, Options) -> {ok, ServiceThriftClientList} when
    Host        :: nonempty_string(),
    Port        :: non_neg_integer(),
    Services    :: multiplexed_service_map(),
    Options     :: list(),
    ServiceThriftClientList :: [{ServiceName::list(), ThriftClient::term()}].
new_multiplexed(Host, Port, Services, Options) when is_integer(Port),
                                                    is_list(Services),
                                                    is_list(Options) ->
    new_multiplexed(thrift_socket_transport:new_transport_factory(Host, Port, Options), Services, Options).

-spec new_multiplexed(TransportFactoryTuple, Services, Options) -> {ok, ServiceThriftClientList} when
    TransportFactoryTuple   :: {ok, TransportFactory::term()},
    Services                :: multiplexed_service_map(),
    Options                 :: list(),
    ServiceThriftClientList :: [{ServiceName::service_name(), ThriftClient::term()}].
new_multiplexed(TransportFactoryTuple, Services, Options) when is_list(Services),
                                                               is_list(Options),
                                                               is_tuple(TransportFactoryTuple) ->
    {ProtoOpts, _} = split_options(Options),

    {ok, TransportFactory} = TransportFactoryTuple,

    {ok, ProtocolFactory} = thrift_binary_protocol:new_protocol_factory(TransportFactory, ProtoOpts),

    {ok, Protocol} = ProtocolFactory(),

    {ok, [{ServiceName, element(2, thrift_client:new(element(2, thrift_multiplexed_protocol:new(Protocol, ServiceName)), Service))} || {ServiceName, Service} <- Services]}.
