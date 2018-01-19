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

-module(thrift_transport_state_test).

-behaviour(gen_server).
-behaviour(thrift_transport).

%% API
-export([new/1]).

%% gen_server callbacks
-export([init/1, handle_call/3, handle_cast/2, handle_info/2,
         terminate/2, code_change/3]).

%% thrift_transport callbacks
-export([write/2, read/2, flush/1, close/1]).

-record(trans, {wrapped, % #thrift_transport{}
                version :: integer(),
                counter :: pid()
               }).
-type state() :: #trans{}.
-include("thrift_transport_behaviour.hrl").

-record(state, {cversion :: integer()}).


new(WrappedTransport) ->
    case gen_server:start_link(?MODULE, [], []) of
        {ok, Pid} ->
            Trans = #trans{wrapped = WrappedTransport,
                           version = 0,
                           counter = Pid},
            thrift_transport:new(?MODULE, Trans);
        Else ->
            Else
    end.

%%====================================================================
%% thrift_transport callbacks
%%====================================================================

write(Transport0 = #trans{wrapped = Wrapped0}, Data) ->
    Transport1 = check_version(Transport0),
    {Wrapped1, Result} = thrift_transport:write(Wrapped0, Data),
    Transport2 = Transport1#trans{wrapped = Wrapped1},
    {Transport2, Result}.

flush(Transport0 = #trans{wrapped = Wrapped0}) ->
    Transport1 = check_version(Transport0),
    {Wrapped1, Result} = thrift_transport:flush(Wrapped0),
    Transport2 = Transport1#trans{wrapped = Wrapped1},
    {Transport2, Result}.

close(Transport0 = #trans{wrapped = Wrapped0}) ->
    Transport1 = check_version(Transport0),
    shutdown_counter(Transport1),
    {Wrapped1, Result} = thrift_transport:close(Wrapped0),
    Transport2 = Transport1#trans{wrapped = Wrapped1},
    {Transport2, Result}.

read(Transport0 = #trans{wrapped = Wrapped0}, Len) ->
    Transport1 = check_version(Transport0),
    {Wrapped1, Result} = thrift_transport:read(Wrapped0, Len),
    Transport2 = Transport1#trans{wrapped = Wrapped1},
    {Transport2, Result}.


%%====================================================================
%% gen_server callbacks
%%====================================================================

init([]) ->
    {ok, #state{cversion = 0}}.

handle_call(check_version, _From, State = #state{cversion = Version}) ->
    {reply, Version, State#state{cversion = Version+1}}.

handle_cast(shutdown, State) ->
    {stop, normal, State}.

handle_info(_Info, State) -> {noreply, State}.
code_change(_OldVsn, State, _Extra) -> {ok, State}.
terminate(_Reason, _State) -> ok.

%%--------------------------------------------------------------------
%% Internal functions
%%--------------------------------------------------------------------

check_version(Transport = #trans{version = Version, counter = Counter}) ->
    case gen_server:call(Counter, check_version) of
        Version ->
            Transport#trans{version = Version+1};
        _Else ->
            % State wasn't propagated properly.  Die.
            erlang:error(state_not_propagated)
    end.

shutdown_counter(#trans{counter = Counter}) ->
    gen_server:cast(Counter, shutdown).
