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

-module(thrift_base64_transport).

-behaviour(thrift_transport).

%% API
-export([new/1, new_transport_factory/1]).

%% thrift_transport callbacks
-export([write/2, read/2, flush/1, close/1]).

%% State
-record(b64_transport, {wrapped}).
-type state() :: #b64_transport{}.
-include("thrift_transport_behaviour.hrl").

new(Wrapped) ->
    State = #b64_transport{wrapped = Wrapped},
    thrift_transport:new(?MODULE, State).


write(This = #b64_transport{wrapped = Wrapped}, Data) ->
    {NewWrapped, Result} = thrift_transport:write(Wrapped, base64:encode(iolist_to_binary(Data))),
    {This#b64_transport{wrapped = NewWrapped}, Result}.


%% base64 doesn't support reading quite yet since it would involve
%% nasty buffering and such
read(This = #b64_transport{}, _Data) ->
    {This, {error, no_reads_allowed}}.


flush(This = #b64_transport{wrapped = Wrapped0}) ->
    {Wrapped1, ok} = thrift_transport:write(Wrapped0, <<"\n">>),
    {Wrapped2, ok} = thrift_transport:flush(Wrapped1),
    {This#b64_transport{wrapped = Wrapped2}, ok}.


close(This0) ->
    {This1 = #b64_transport{wrapped = Wrapped}, ok} = flush(This0),
    {NewWrapped, ok} = thrift_transport:close(Wrapped),
    {This1#b64_transport{wrapped = NewWrapped}, ok}.


%%%% FACTORY GENERATION %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
new_transport_factory(WrapFactory) ->
    F = fun() ->
                {ok, Wrapped} = WrapFactory(),
                new(Wrapped)
        end,
    {ok, F}.
