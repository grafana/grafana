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

-module(server).

-include("calculator_thrift.hrl").

-export([start/0, start/1, handle_function/2,
         stop/1, ping/0, add/2, calculate/2, getStruct/1, zip/0]).

debug(Format, Data) ->
    error_logger:info_msg(Format, Data).

ping() ->
    debug("ping()",[]),
    ok.

add(N1, N2) ->
    debug("add(~p,~p)",[N1,N2]),
    N1+N2.

calculate(Logid, Work) ->
    { Op, Num1, Num2 } = { Work#work.op, Work#work.num1, Work#work.num2 },
    debug("calculate(~p, {~p,~p,~p})", [Logid, Op, Num1, Num2]),
    case Op of
        ?tutorial_Operation_ADD      -> Num1 + Num2;
        ?tutorial_Operation_SUBTRACT -> Num1 - Num2;
        ?tutorial_Operation_MULTIPLY -> Num1 * Num2;

        ?tutorial_Operation_DIVIDE when Num2 == 0 ->
          throw(#invalidOperation{whatOp=Op, why="Cannot divide by 0"});
        ?tutorial_Operation_DIVIDE ->
          Num1 div Num2;

        _Else ->
          throw(#invalidOperation{whatOp=Op, why="Invalid operation"})
    end.

getStruct(Key) ->
    debug("getStruct(~p)", [Key]),
    #sharedStruct{key=Key, value="RARG"}.

zip() ->
    debug("zip", []),
    ok.

%%

start() ->
    start(9999).

start(Port) ->
    Handler   = ?MODULE,
    thrift_socket_server:start([{handler, Handler},
                                {service, calculator_thrift},
                                {port, Port},
                                {name, tutorial_server}]).

stop(Server) ->
    thrift_socket_server:stop(Server).

handle_function(Function, Args) when is_atom(Function), is_tuple(Args) ->
    case apply(?MODULE, Function, tuple_to_list(Args)) of
        ok -> ok;
        Reply -> {reply, Reply}
    end.
