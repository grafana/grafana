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

-module(thrift_framed_transport).

-behaviour(thrift_transport).

%% constructor
-export([new/1]).
%% protocol callbacks
-export([read/2, read_exact/2, write/2, flush/1, close/1]).


-record(t_framed, {
  wrapped,
  read_buffer,
  write_buffer
}).

-type state() :: #t_framed{}.


-spec new(Transport::thrift_transport:t_transport()) ->
  thrift_transport:t_transport().

new(Wrapped) ->
  State = #t_framed{
    wrapped = Wrapped,
    read_buffer = [],
    write_buffer = []
  },
  thrift_transport:new(?MODULE, State).


-include("thrift_transport_behaviour.hrl").


read(State = #t_framed{wrapped = Wrapped, read_buffer = Buffer}, Len)
when is_integer(Len), Len >= 0 ->
  Binary = iolist_to_binary(Buffer),
  case Binary of
    <<>> when Len > 0 ->
      case next_frame(Wrapped) of
        {NewState, {ok, Frame}} ->
          NewBinary = iolist_to_binary([Binary, Frame]),
          Give = min(iolist_size(NewBinary), Len),
          {Result, Remaining} = split_binary(NewBinary, Give),
          {State#t_framed{wrapped = NewState, read_buffer = Remaining}, {ok, Result}};
        Error -> Error
      end;
    %% read of zero bytes
    <<>> -> {State, {ok, <<>>}};
    %% read buffer is nonempty
    _ ->
      Give = min(iolist_size(Binary), Len),
      {Result, Remaining} = split_binary(Binary, Give),
      {State#t_framed{read_buffer = Remaining}, {ok, Result}}
  end.


read_exact(State = #t_framed{wrapped = Wrapped, read_buffer = Buffer}, Len)
when is_integer(Len), Len >= 0 ->
  Binary = iolist_to_binary(Buffer),
  case iolist_size(Binary) of
    %% read buffer is larger than requested read size
    X when X >= Len ->
      {Result, Remaining} = split_binary(Binary, Len),
      {State#t_framed{read_buffer = Remaining}, {ok, Result}};
    %% read buffer is insufficient for requested read size
    _ ->
      case next_frame(Wrapped) of
        {NewState, {ok, Frame}} ->
          read_exact(
            State#t_framed{wrapped = NewState, read_buffer = [Buffer, Frame]},
            Len
          );
        {NewState, Error} ->
          {State#t_framed{wrapped = NewState}, Error}
      end
  end.

next_frame(Transport) ->
  case thrift_transport:read_exact(Transport, 4) of
    {NewState, {ok, <<FrameLength:32/integer-signed-big>>}} ->
      thrift_transport:read_exact(NewState, FrameLength);
    Error -> Error
  end.


write(State = #t_framed{write_buffer = Buffer}, Data) ->
  {State#t_framed{write_buffer = [Buffer, Data]}, ok}.


flush(State = #t_framed{write_buffer = Buffer, wrapped = Wrapped}) ->
  case iolist_size(Buffer) of
    %% if write buffer is empty, do nothing
    0 -> {State, ok};
    FrameLen ->
      Data = [<<FrameLen:32/integer-signed-big>>, Buffer],
      {Written, Response} = thrift_transport:write(Wrapped, Data),
      {Flushed, ok} = thrift_transport:flush(Written),
      {State#t_framed{wrapped = Flushed, write_buffer = []}, Response}
  end.


close(State = #t_framed{wrapped = Wrapped}) ->
  {Closed, Result} = thrift_transport:close(Wrapped),
  {State#t_framed{wrapped = Closed}, Result}.

