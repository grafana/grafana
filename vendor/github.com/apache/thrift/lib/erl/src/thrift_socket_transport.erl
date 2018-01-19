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

-module(thrift_socket_transport).

-behaviour(thrift_transport).

%% constructors
-export([new/1, new/2]).
%% transport callbacks
-export([read/2, read_exact/2, write/2, flush/1, close/1]).
%% legacy api
-export([new_transport_factory/3]).


-record(t_socket, {
  socket,
  recv_timeout=60000,
  buffer = []
}).

-type state() :: #t_socket{}.


-spec new(Socket::any()) ->
  thrift_transport:t_transport().

new(Socket) -> new(Socket, []).

-spec new(Socket::any(), Opts::list()) ->
  thrift_transport:t_transport().

new(Socket, Opts) when is_list(Opts) ->
  State = parse_opts(Opts, #t_socket{socket = Socket}),
  thrift_transport:new(?MODULE, State).


parse_opts([{recv_timeout, Timeout}|Rest], State)
when is_integer(Timeout), Timeout > 0 ->
  parse_opts(Rest, State#t_socket{recv_timeout = Timeout});
parse_opts([{recv_timeout, infinity}|Rest], State) ->
  parse_opts(Rest, State#t_socket{recv_timeout = infinity});
parse_opts([], State) ->
  State.


-include("thrift_transport_behaviour.hrl").


read(State = #t_socket{buffer = Buf}, Len)
when is_integer(Len), Len >= 0 ->
  Binary = iolist_to_binary(Buf),
  case iolist_size(Binary) of
    X when X >= Len ->
      {Result, Remaining} = split_binary(Binary, Len),
      {State#t_socket{buffer = Remaining}, {ok, Result}};
    _ -> recv(State, Len)
  end.

recv(State = #t_socket{socket = Socket, buffer = Buf}, Len) ->
  case gen_tcp:recv(Socket, 0, State#t_socket.recv_timeout) of
    {error, Error} ->
      gen_tcp:close(Socket),
      {State, {error, Error}};
    {ok, Data} ->
      Binary = iolist_to_binary([Buf, Data]),
      Give = min(iolist_size(Binary), Len),
      {Result, Remaining} = split_binary(Binary, Give),
      {State#t_socket{buffer = Remaining}, {ok, Result}}
  end.


read_exact(State = #t_socket{buffer = Buf}, Len)
when is_integer(Len), Len >= 0 ->
  Binary = iolist_to_binary(Buf),
  case iolist_size(Binary) of
    X when X >= Len -> read(State, Len);
    X ->
      case gen_tcp:recv(State#t_socket.socket, Len - X, State#t_socket.recv_timeout) of
        {error, Error} ->
          gen_tcp:close(State#t_socket.socket),
          {State, {error, Error}};
        {ok, Data} ->
          {State#t_socket{buffer = []}, {ok, <<Binary/binary, Data/binary>>}}
      end
  end.


write(State = #t_socket{socket = Socket}, Data) ->
  case gen_tcp:send(Socket, Data) of
    {error, Error} ->
      gen_tcp:close(Socket),
      {State, {error, Error}};
    ok -> {State, ok}
  end.


flush(State) ->
  {State#t_socket{buffer = []}, ok}.


close(State = #t_socket{socket = Socket}) ->
  {State, gen_tcp:close(Socket)}.


%% legacy api. left for compatibility

%% The following "local" record is filled in by parse_factory_options/2
%% below. These options can be passed to new_protocol_factory/3 in a
%% proplists-style option list. They're parsed like this so it is an O(n)
%% operation instead of O(n^2)
-record(factory_opts, {
  connect_timeout = infinity,
  sockopts = [],
  framed = false
}).

parse_factory_options([], FactoryOpts, TransOpts) -> {FactoryOpts, TransOpts};
parse_factory_options([{framed, Bool}|Rest], FactoryOpts, TransOpts)
when is_boolean(Bool) ->
  parse_factory_options(Rest, FactoryOpts#factory_opts{framed = Bool}, TransOpts);
parse_factory_options([{sockopts, OptList}|Rest], FactoryOpts, TransOpts)
when is_list(OptList) ->
  parse_factory_options(Rest, FactoryOpts#factory_opts{sockopts = OptList}, TransOpts);
parse_factory_options([{connect_timeout, TO}|Rest], FactoryOpts, TransOpts)
when TO =:= infinity; is_integer(TO) ->
  parse_factory_options(Rest, FactoryOpts#factory_opts{connect_timeout = TO}, TransOpts);
parse_factory_options([{recv_timeout, TO}|Rest], FactoryOpts, TransOpts)
when TO =:= infinity; is_integer(TO) ->
  parse_factory_options(Rest, FactoryOpts, [{recv_timeout, TO}] ++ TransOpts).


%% Generates a "transport factory" function - a fun which returns a thrift_transport()
%% instance.
%% State can be passed into a protocol factory to generate a connection to a
%% thrift server over a socket.
new_transport_factory(Host, Port, Options) ->
  {FactoryOpts, TransOpts} = parse_factory_options(Options, #factory_opts{}, []),
  {ok, fun() -> SockOpts = [binary,
      {packet, 0},
      {active, false},
      {nodelay, true}|FactoryOpts#factory_opts.sockopts
    ],
    case catch gen_tcp:connect(
      Host,
      Port,
      SockOpts,
      FactoryOpts#factory_opts.connect_timeout
    ) of
      {ok, Sock} ->
        {ok, Transport} = thrift_socket_transport:new(Sock, TransOpts),
        {ok, BufTransport} = case FactoryOpts#factory_opts.framed of
          true  -> thrift_framed_transport:new(Transport);
          false -> thrift_buffered_transport:new(Transport)
        end,
        {ok, BufTransport};
      Error  -> Error
    end
  end}.

