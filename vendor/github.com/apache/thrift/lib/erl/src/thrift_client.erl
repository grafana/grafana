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

-module(thrift_client).

%% API
-export([new/2, call/3, send_call/3, close/1]).

-include("thrift_constants.hrl").
-include("thrift_protocol.hrl").

-record(tclient, {service, protocol, seqid}).


new(Protocol, Service)
  when is_atom(Service) ->
    {ok, #tclient{protocol = Protocol,
                  service = Service,
                  seqid = 0}}.

-spec call(#tclient{}, atom(), list()) -> {#tclient{}, {ok, any()} | {error, any()}}.
call(Client = #tclient{}, Function, Args)
when is_atom(Function), is_list(Args) ->
  case send_function_call(Client, Function, Args) of
    {ok, Client1} -> receive_function_result(Client1, Function);
    {{error, X}, Client1} -> {Client1, {error, X}};
    Else -> Else
  end.


%% Sends a function call but does not read the result. This is useful
%% if you're trying to log non-oneway function calls to write-only
%% transports like thrift_disk_log_transport.
-spec send_call(#tclient{}, atom(), list()) -> {#tclient{}, ok}.
send_call(Client = #tclient{}, Function, Args)
  when is_atom(Function), is_list(Args) ->
    case send_function_call(Client, Function, Args) of
      {ok, Client1} -> {Client1, ok};
      Else -> Else
    end.

-spec close(#tclient{}) -> ok.
close(#tclient{protocol=Protocol}) ->
    thrift_protocol:close_transport(Protocol).


%%--------------------------------------------------------------------
%%% Internal functions
%%--------------------------------------------------------------------
-spec send_function_call(#tclient{}, atom(), list()) -> {ok | {error, any()}, #tclient{}}.
send_function_call(Client = #tclient{service = Service}, Function, Args) ->
  {Params, Reply} = try
    {Service:function_info(Function, params_type), Service:function_info(Function, reply_type)}
  catch error:function_clause -> {no_function, 0}
  end,
  MsgType = case Reply of
    oneway_void -> ?tMessageType_ONEWAY;
    _ -> ?tMessageType_CALL
  end,
  case Params of
    no_function ->
      {{error, {no_function, Function}}, Client};
    {struct, PList} when length(PList) =/= length(Args) ->
      {{error, {bad_args, Function, Args}}, Client};
    {struct, _PList} -> write_message(Client, Function, Args, Params, MsgType)
  end.

-spec write_message(#tclient{}, atom(), list(), {struct, list()}, integer()) ->
  {ok | {error, any()}, #tclient{}}.
write_message(Client = #tclient{protocol = P0, seqid = Seq}, Function, Args, Params, MsgType) ->
  try
    {P1, ok} = thrift_protocol:write(P0, #protocol_message_begin{
      name = atom_to_list(Function),
      type = MsgType,
      seqid = Seq
    }),
    {P2, ok} = thrift_protocol:write(P1, {Params, list_to_tuple([Function|Args])}),
    {P3, ok} = thrift_protocol:write(P2, message_end),
    {P4, ok} = thrift_protocol:flush_transport(P3),
    {ok, Client#tclient{protocol = P4}}
  catch
    error:{badmatch, {_, {error, _} = Error}} -> {Error, Client}
  end.

-spec receive_function_result(#tclient{}, atom()) -> {#tclient{}, {ok, any()} | {error, any()}}.
receive_function_result(Client = #tclient{service = Service}, Function) ->
    ResultType = Service:function_info(Function, reply_type),
    read_result(Client, Function, ResultType).

read_result(Client, _Function, oneway_void) ->
    {Client, {ok, ok}};

read_result(Client = #tclient{protocol = Proto0,
                              seqid    = SeqId},
            Function,
            ReplyType) ->
    case thrift_protocol:read(Proto0, message_begin) of
         {Proto1, {error, Reason}} ->
             NewClient = Client#tclient{protocol = Proto1},
             {NewClient, {error, Reason}};
         {Proto1, MessageBegin} ->
             NewClient = Client#tclient{protocol = Proto1},
             case MessageBegin of
                 #protocol_message_begin{seqid = RetSeqId} when RetSeqId =/= SeqId ->
                     {NewClient, {error, {bad_seq_id, SeqId}}};
                 #protocol_message_begin{type = ?tMessageType_EXCEPTION} ->
                     handle_application_exception(NewClient);
                 #protocol_message_begin{type = ?tMessageType_REPLY} ->
                     handle_reply(NewClient, Function, ReplyType)
             end
    end.


handle_reply(Client = #tclient{protocol = Proto0,
                               service = Service},
             Function,
             ReplyType) ->
    {struct, ExceptionFields} = Service:function_info(Function, exceptions),
    ReplyStructDef = {struct, [{0, ReplyType}] ++ ExceptionFields},
    {Proto1, {ok, Reply}} = thrift_protocol:read(Proto0, ReplyStructDef),
    {Proto2, ok} = thrift_protocol:read(Proto1, message_end),
    NewClient = Client#tclient{protocol = Proto2},
    ReplyList = tuple_to_list(Reply),
    true = length(ReplyList) == length(ExceptionFields) + 1,
    ExceptionVals = tl(ReplyList),
    Thrown = [X || X <- ExceptionVals,
                   X =/= undefined],
    case Thrown of
        [] when ReplyType == {struct, []} ->
            {NewClient, {ok, ok}};
        [] ->
            {NewClient, {ok, hd(ReplyList)}};
        [Exception] ->
            throw({NewClient, {exception, Exception}})
    end.

handle_application_exception(Client = #tclient{protocol = Proto0}) ->
    {Proto1, {ok, Exception}} =
        thrift_protocol:read(Proto0, ?TApplicationException_Structure),
    {Proto2, ok} = thrift_protocol:read(Proto1, message_end),
    XRecord = list_to_tuple(
                ['TApplicationException' | tuple_to_list(Exception)]),
    error_logger:error_msg("X: ~p~n", [XRecord]),
    true = is_record(XRecord, 'TApplicationException'),
    NewClient = Client#tclient{protocol = Proto2},
    throw({NewClient, {exception, XRecord}}).
