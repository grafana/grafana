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

-module(thrift_buffered_transport).

-behaviour(thrift_transport).

%% constructor
-export([new/1]).
%% protocol callbacks
-export([read/2, read_exact/2, write/2, flush/1, close/1]).
%% legacy api
-export([new_transport_factory/1]).


-record(t_buffered, {
  wrapped,
  write_buffer
}).

-type state() :: #t_buffered{}.


-spec new(Transport::thrift_transport:t_transport()) ->
  thrift_transport:t_transport().

new(Wrapped) ->
  State = #t_buffered{
    wrapped = Wrapped,
    write_buffer = []
  },
  thrift_transport:new(?MODULE, State).


-include("thrift_transport_behaviour.hrl").


%% reads data through from the wrapped transport
read(State = #t_buffered{wrapped = Wrapped}, Len)
when is_integer(Len), Len >= 0 ->
  {NewState, Response} = thrift_transport:read(Wrapped, Len),
  {State#t_buffered{wrapped = NewState}, Response}.


%% reads data through from the wrapped transport
read_exact(State = #t_buffered{wrapped = Wrapped}, Len)
when is_integer(Len), Len >= 0 ->
  {NewState, Response} = thrift_transport:read_exact(Wrapped, Len),
  {State#t_buffered{wrapped = NewState}, Response}.


write(State = #t_buffered{write_buffer = Buffer}, Data) ->
  {State#t_buffered{write_buffer = [Buffer, Data]}, ok}.


flush(State = #t_buffered{wrapped = Wrapped, write_buffer = Buffer}) ->
  case iolist_size(Buffer) of
    %% if write buffer is empty, do nothing
    0 -> {State, ok};
    _ ->
      {Written, Response} = thrift_transport:write(Wrapped, Buffer),
      {Flushed, ok} = thrift_transport:flush(Written),
      {State#t_buffered{wrapped = Flushed, write_buffer = []}, Response}
  end.


close(State = #t_buffered{wrapped = Wrapped}) ->
  {Closed, Result} = thrift_transport:close(Wrapped),
  {State#t_buffered{wrapped = Closed}, Result}.


%%--------------------------------------------------------------------
%%% Internal functions
%%--------------------------------------------------------------------
%%%% FACTORY GENERATION %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%
new_transport_factory(WrapFactory) ->
  F = fun() ->
    {ok, Wrapped} = WrapFactory(),
    new(Wrapped)
  end,
  {ok, F}.

