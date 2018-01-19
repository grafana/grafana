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

%%% Todo: this might be better off as a gen_server type of transport
%%%       that handles stuff like group commit, similar to TFileTransport
%%%       in cpp land
-module(thrift_disk_log_transport).

-behaviour(thrift_transport).

%% API
-export([new/2, new_transport_factory/2, new_transport_factory/3]).

%% thrift_transport callbacks
-export([read/2, write/2, force_flush/1, flush/1, close/1]).

%% state
-record(dl_transport, {log,
                       close_on_close = false,
                       sync_every = infinity,
                       sync_tref}).
-type state() :: #dl_transport{}.
-include("thrift_transport_behaviour.hrl").


%% Create a transport attached to an already open log.
%% If you'd like this transport to close the disk_log using disk_log:lclose()
%% when the transport is closed, pass a {close_on_close, true} tuple in the
%% Opts list.
new(LogName, Opts) when is_atom(LogName), is_list(Opts) ->
    State = parse_opts(Opts, #dl_transport{log = LogName}),

    State2 =
        case State#dl_transport.sync_every of
            N when is_integer(N), N > 0 ->
                {ok, TRef} = timer:apply_interval(N, ?MODULE, force_flush, [State]),
                State#dl_transport{sync_tref = TRef};
            _ -> State
        end,

    thrift_transport:new(?MODULE, State2).


parse_opts([], State) ->
    State;
parse_opts([{close_on_close, Bool} | Rest], State) when is_boolean(Bool) ->
    parse_opts(Rest, State#dl_transport{close_on_close = Bool});
parse_opts([{sync_every, Int} | Rest], State) when is_integer(Int), Int > 0 ->
    parse_opts(Rest, State#dl_transport{sync_every = Int}).


%%%% TRANSPORT IMPLENTATION %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%% disk_log_transport is write-only
read(State, _Len) ->
    {State, {error, no_read_from_disk_log}}.

write(This = #dl_transport{log = Log}, Data) ->
    {This, disk_log:balog(Log, erlang:iolist_to_binary(Data))}.

force_flush(#dl_transport{log = Log}) ->
    error_logger:info_msg("~p syncing~n", [?MODULE]),
    disk_log:sync(Log).

flush(This = #dl_transport{log = Log, sync_every = SE}) ->
    case SE of
        undefined -> % no time-based sync
            disk_log:sync(Log);
        _Else ->     % sync will happen automagically
            ok
    end,
    {This, ok}.




%% On close, close the underlying log if we're configured to do so.
close(This = #dl_transport{close_on_close = false}) ->
    {This, ok};
close(This = #dl_transport{log = Log}) ->
    {This, disk_log:lclose(Log)}.


%%%% FACTORY GENERATION %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

new_transport_factory(Name, ExtraLogOpts) ->
    new_transport_factory(Name, ExtraLogOpts, [{close_on_close, true},
                                               {sync_every, 500}]).

new_transport_factory(Name, ExtraLogOpts, TransportOpts) ->
    F = fun() -> factory_impl(Name, ExtraLogOpts, TransportOpts) end,
    {ok, F}.

factory_impl(Name, ExtraLogOpts, TransportOpts) ->
    LogOpts = [{name, Name},
               {format, external},
               {type, wrap} |
               ExtraLogOpts],
    Log =
        case disk_log:open(LogOpts) of
            {ok, LogS} ->
                LogS;
            {repaired, LogS, Info1, Info2} ->
                error_logger:info_msg("Disk log ~p repaired: ~p, ~p~n", [LogS, Info1, Info2]),
                LogS
        end,
    new(Log, TransportOpts).
