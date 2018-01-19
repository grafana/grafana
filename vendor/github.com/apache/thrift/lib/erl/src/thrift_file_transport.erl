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

-module(thrift_file_transport).

-behaviour(thrift_transport).

%% constructors
-export([new/1, new/2]).
%% protocol callbacks
-export([read/2, read_exact/2, write/2, flush/1, close/1]).
%% legacy api
-export([new_reader/1]).


-record(t_file, {
  device,
  should_close = true,
  mode = write
}).

-type state() :: #t_file{}.


-spec new(Device::file:io_device()) ->
  thrift_transport:t_transport().

new(Device) -> new(Device, []).

-spec new(Device::file:io_device(), Opts::list()) ->
  thrift_transport:t_transport().

%% Device should be opened in raw and binary mode.
new(Device, Opts) when is_list(Opts) ->
  State = parse_opts(Opts, #t_file{device = Device}),
  thrift_transport:new(?MODULE, State).


parse_opts([{should_close, Bool}|Rest], State)
when is_boolean(Bool) ->
  parse_opts(Rest, State#t_file{should_close = Bool});
parse_opts([{mode, Mode}|Rest], State)
when Mode =:= write; Mode =:= read ->
  parse_opts(Rest, State#t_file{mode = Mode});
parse_opts([], State) ->
  State.


-include("thrift_transport_behaviour.hrl").


read(State = #t_file{device = Device, mode = read}, Len)
when is_integer(Len), Len >= 0 ->
  case file:read(Device, Len) of
    eof -> {State, {error, eof}};
    {ok, Result} -> {State, {ok, iolist_to_binary(Result)}}
  end;
read(State, _) ->
  {State, {error, write_mode}}.


read_exact(State = #t_file{device = Device, mode = read}, Len)
when is_integer(Len), Len >= 0 ->
  case file:read(Device, Len) of
    eof -> {State, {error, eof}};
    {ok, Result} ->
      case iolist_size(Result) of
        X when X < Len -> {State, {error, eof}};
        _ -> {State, {ok, iolist_to_binary(Result)}}
      end
  end;
read_exact(State, _) ->
  {State, {error, write_mode}}.


write(State = #t_file{device = Device, mode = write}, Data) ->
  {State, file:write(Device, Data)};
write(State, _) ->
  {State, {error, read_mode}}.


flush(State = #t_file{device = Device, mode = write}) ->
  {State, file:sync(Device)}.


close(State = #t_file{device = Device, should_close = SC}) ->
  case SC of
    true -> {State, file:close(Device)};
    false -> {State, ok}
  end.


%% legacy api. left for compatibility
new_reader(Filename) ->
  case file:open(Filename, [read, binary, {read_ahead, 1024*1024}]) of
    {ok, IODevice} -> new(IODevice, [{should_close, true}, {mode, read}]);
    Error -> Error
  end.

