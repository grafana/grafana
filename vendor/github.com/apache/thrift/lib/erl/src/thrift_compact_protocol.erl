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

-module(thrift_compact_protocol).

-behaviour(thrift_protocol).

-include("thrift_constants.hrl").
-include("thrift_protocol.hrl").

-export([new/1, new/2,
         read/2,
         write/2,
         flush_transport/1,
         close_transport/1,
         new_protocol_factory/2
        ]).

-define(ID_NONE, 16#10000).
-define(CBOOL_NONE, 0).
-define(CBOOL_TRUE, 1).
-define(CBOOL_FALSE, 2).

-record(t_compact, {transport,
                           % state for pending boolean fields
                           read_stack=[],
                           read_value=?CBOOL_NONE,
                           write_stack=[],
                           write_id=?ID_NONE
                          }).
-type state() :: #t_compact{}.
-include("thrift_protocol_behaviour.hrl").

-define(PROTOCOL_ID, 16#82).
-define(VERSION_MASK, 16#1f).
-define(VERSION_1, 16#01).
-define(TYPE_MASK, 16#E0).
-define(TYPE_BITS, 16#07).
-define(TYPE_SHIFT_AMOUNT, 5).

typeid_to_compact(?tType_STOP) -> 16#0;
typeid_to_compact(?tType_BOOL) -> 16#2;
typeid_to_compact(?tType_I8) -> 16#3;
typeid_to_compact(?tType_I16) -> 16#4;
typeid_to_compact(?tType_I32) -> 16#5;
typeid_to_compact(?tType_I64) -> 16#6;
typeid_to_compact(?tType_DOUBLE) -> 16#7;
typeid_to_compact(?tType_STRING) -> 16#8;
typeid_to_compact(?tType_STRUCT) -> 16#C;
typeid_to_compact(?tType_MAP) -> 16#B;
typeid_to_compact(?tType_SET) -> 16#A;
typeid_to_compact(?tType_LIST) -> 16#9.

compact_to_typeid(16#0) ->  ?tType_STOP;
compact_to_typeid(?CBOOL_FALSE) ->  ?tType_BOOL;
compact_to_typeid(?CBOOL_TRUE) ->  ?tType_BOOL;
compact_to_typeid(16#7) ->  ?tType_DOUBLE;
compact_to_typeid(16#3) ->  ?tType_I8;
compact_to_typeid(16#4) ->  ?tType_I16;
compact_to_typeid(16#5) ->  ?tType_I32;
compact_to_typeid(16#6) ->  ?tType_I64;
compact_to_typeid(16#8) ->  ?tType_STRING;
compact_to_typeid(16#C) ->  ?tType_STRUCT;
compact_to_typeid(16#B) ->  ?tType_MAP;
compact_to_typeid(16#A) ->  ?tType_SET;
compact_to_typeid(16#9) ->  ?tType_LIST.

bool_to_cbool(Value) when Value -> ?CBOOL_TRUE;
bool_to_cbool(_) -> ?CBOOL_FALSE.
cbool_to_bool(Value) -> Value =:= ?CBOOL_TRUE.

new(Transport) -> new(Transport, _Options = []).

new(Transport, _Options) ->
  State  = #t_compact{transport = Transport},
  thrift_protocol:new(?MODULE, State).

flush_transport(This = #t_compact{transport = Transport}) ->
  {NewTransport, Result} = thrift_transport:flush(Transport),
  {This#t_compact{transport = NewTransport}, Result}.

close_transport(This = #t_compact{transport = Transport}) ->
  {NewTransport, Result} = thrift_transport:close(Transport),
  {This#t_compact{transport = NewTransport}, Result}.

%%%
%%% instance methods
%%%

write_field_begin(This0 = #t_compact{write_stack=[LastId|T]}, CompactType, Id) ->
  IdDiff = Id - LastId,
  This1 = This0#t_compact{write_stack=[Id|T]},
  case (IdDiff > 0) and (IdDiff < 16) of
    true -> write(This1, {byte, (IdDiff bsl 4) bor CompactType});
    false ->
      {This2, ok} = write(This1, {byte, CompactType}),
      write(This2, {i16, Id})
  end.

-spec to_zigzag(integer()) -> non_neg_integer().
to_zigzag(Value) -> 16#FFFFFFFFFFFFFFFF band ((Value bsl 1) bxor (Value bsr 63)).

-spec from_zigzag(non_neg_integer()) -> integer().
from_zigzag(Value) -> (Value bsr 1) bxor -(Value band 1).

-spec to_varint(non_neg_integer(), iolist()) -> iolist().
to_varint(Value, Acc) when (Value < 16#80) -> [Acc, Value];
to_varint(Value, Acc) ->
  to_varint(Value bsr 7, [Acc, ((Value band 16#7F) bor 16#80)]).

-spec read_varint(#t_compact{}, non_neg_integer(), non_neg_integer()) -> non_neg_integer().
read_varint(This0, Acc, Count) ->
  {This1, {ok, Byte}} = read(This0, byte),
  case (Byte band 16#80) of
    0 -> {This1, {ok, (Byte bsl (7 * Count)) + Acc}};
    _ -> read_varint(This1, ((Byte band 16#7f) bsl (7 * Count)) + Acc, Count + 1)
  end.

write(This0, #protocol_message_begin{
        name = Name,
        type = Type,
        seqid = Seqid}) ->
  {This1, ok} = write(This0, {byte, ?PROTOCOL_ID}),
  {This2, ok} = write(This1, {byte, (?VERSION_1 band ?VERSION_MASK) bor (Type bsl ?TYPE_SHIFT_AMOUNT)}),
  {This3, ok} = write(This2, {ui32, Seqid}),
  {This4, ok} = write(This3, {string, Name}),
  {This4, ok};

write(This, message_end) -> {This, ok};

write(This0, #protocol_field_begin{
       name = _Name,
       type = Type,
       id = Id})
when (Type =:= ?tType_BOOL) -> {This0#t_compact{write_id = Id}, ok};

write(This0, #protocol_field_begin{
       name = _Name,
       type = Type,
       id = Id}) ->
  write_field_begin(This0, typeid_to_compact(Type), Id);

write(This, field_stop) -> write(This, {byte, ?tType_STOP});

write(This, field_end) -> {This, ok};

write(This0, #protocol_map_begin{
      ktype = _Ktype,
      vtype = _Vtype,
      size = Size})
when Size =:= 0 ->
  write(This0, {byte, 0});

write(This0, #protocol_map_begin{
       ktype = Ktype,
       vtype = Vtype,
       size = Size}) ->
  {This1, ok} = write(This0, {ui32, Size}),
  write(This1, {byte, (typeid_to_compact(Ktype) bsl 4) bor typeid_to_compact(Vtype)});

write(This, map_end) -> {This, ok};

write(This0, #protocol_list_begin{
        etype = Etype,
        size = Size})
when Size < 16#f ->
  write(This0, {byte, (Size bsl 4) bor typeid_to_compact(Etype)});

write(This0, #protocol_list_begin{
        etype = Etype,
        size = Size}) ->
  {This1, ok} = write(This0, {byte, 16#f0 bor typeid_to_compact(Etype)}),
  write(This1, {ui32, Size});

write(This, list_end) -> {This, ok};

write(This0, #protocol_set_begin{
        etype = Etype,
        size = Size}) ->
  write(This0, #protocol_list_begin{etype = Etype, size =  Size});

write(This, set_end) -> {This, ok};

write(This = #t_compact{write_stack = Stack}, #protocol_struct_begin{}) ->
  {This#t_compact{write_stack = [0|Stack]}, ok};
write(This = #t_compact{write_stack = [_|T]}, struct_end) ->
  {This#t_compact{write_stack = T}, ok};

write(This = #t_compact{write_id = ?ID_NONE}, {bool, Value}) ->
  write(This, {byte, bool_to_cbool(Value)});

write(This0 = #t_compact{write_id = Id}, {bool, Value}) ->
  {This1, ok} = write_field_begin(This0, bool_to_cbool(Value), Id),
  {This1#t_compact{write_id = ?ID_NONE}, ok};

write(This, {byte, Value}) when is_integer(Value) ->
  write(This, <<Value:8/big-signed>>);

write(This, {i16, Value}) when is_integer(Value) -> write(This, to_varint(to_zigzag(Value), []));
write(This, {ui32, Value}) when is_integer(Value) -> write(This, to_varint(Value, []));
write(This, {i32, Value}) when is_integer(Value) ->
  write(This, to_varint(to_zigzag(Value), []));
write(This, {i64, Value}) when is_integer(Value) -> write(This, to_varint(to_zigzag(Value), []));

write(This, {double, Double}) ->
  write(This, <<Double:64/float-signed-little>>);

write(This0, {string, Str}) when is_list(Str) ->
  % TODO: limit length
  {This1, ok} = write(This0, {ui32, length(Str)}),
  {This2, ok} = write(This1, list_to_binary(Str)),
  {This2, ok};

write(This0, {string, Bin}) when is_binary(Bin) ->
  % TODO: limit length
  {This1, ok} = write(This0, {ui32, size(Bin)}),
  {This2, ok} = write(This1, Bin),
  {This2, ok};

%% Data :: iolist()
write(This = #t_compact{transport = Trans}, Data) ->
  {NewTransport, Result} = thrift_transport:write(Trans, Data),
  {This#t_compact{transport = NewTransport}, Result}.

%%
%%

read(This0, message_begin) ->
  {This1, {ok, ?PROTOCOL_ID}} = read(This0, ubyte),
  {This2, {ok, VerAndType}} = read(This1, ubyte),
  ?VERSION_1 = VerAndType band ?VERSION_MASK,
  {This3, {ok, SeqId}} = read(This2, ui32),
  {This4, {ok, Name}} = read(This3, string),
  {This4, #protocol_message_begin{
             name  = binary_to_list(Name),
             type  = (VerAndType bsr ?TYPE_SHIFT_AMOUNT) band ?TYPE_BITS,
             seqid = SeqId}};

read(This, message_end) -> {This, ok};

read(This = #t_compact{read_stack = Stack}, struct_begin) ->
  {This#t_compact{read_stack = [0|Stack]}, ok};
read(This = #t_compact{read_stack = [_H|T]}, struct_end) ->
  {This#t_compact{read_stack = T}, ok};

read(This0 = #t_compact{read_stack = [LastId|T]}, field_begin) ->
  {This1, {ok, Byte}} = read(This0, ubyte),
  case Byte band 16#f of
    CompactType = ?tType_STOP ->
      {This1, #protocol_field_begin{type = CompactType}};
    CompactType ->
      {This2, {ok, Id}} = case Byte bsr 4 of
                            0 -> read(This1, i16);
                            IdDiff ->
                              {This1, {ok, LastId + IdDiff}}
                          end,
      case compact_to_typeid(CompactType) of
        ?tType_BOOL ->
          {This2#t_compact{read_stack = [Id|T], read_value = cbool_to_bool(CompactType)},
           #protocol_field_begin{type = ?tType_BOOL, id = Id}};
        Type ->
          {This2#t_compact{read_stack = [Id|T]},
           #protocol_field_begin{type = Type, id = Id}}
      end
  end;

read(This, field_end) -> {This, ok};

read(This0, map_begin) ->
  {This1, {ok, Size}}  = read(This0, ui32),
  {This2, {ok, KV}} = case Size of
                        0 -> {This1, {ok, 0}};
                        _ -> read(This1, ubyte)
                      end,
  {This2, #protocol_map_begin{ktype = compact_to_typeid(KV bsr 4),
                              vtype = compact_to_typeid(KV band 16#f),
                              size = Size}};
read(This, map_end) -> {This, ok};

read(This0, list_begin) ->
  {This1, {ok, SizeAndType}} = read(This0, ubyte),
  {This2, {ok, Size}} = case (SizeAndType bsr 4) band 16#f of
                          16#f -> read(This1, ui32);
                          Else -> {This1, {ok, Else}}
                        end,
  {This2, #protocol_list_begin{etype = compact_to_typeid(SizeAndType band 16#f),
                               size = Size}};

read(This, list_end) -> {This, ok};

read(This0, set_begin) ->
  {This1, {ok, SizeAndType}} = read(This0, ubyte),
  {This2, {ok, Size}} = case (SizeAndType bsr 4) band 16#f of
                          16#f -> read(This1, ui32);
                          Else -> {This1, {ok, Else}}
                        end,
  {This2, #protocol_set_begin{etype = compact_to_typeid(SizeAndType band 16#f),
                               size = Size}};

read(This, set_end) -> {This, ok};

read(This0, field_stop) ->
  {This1, {ok, ?tType_STOP}} = read(This0, ubyte),
  {This1, ok};

%%

read(This0 = #t_compact{read_value = ?CBOOL_NONE}, bool) ->
  {This1, {ok, Byte}} = read(This0, ubyte),
  {This1, {ok, cbool_to_bool(Byte)}};

read(This0 = #t_compact{read_value = Bool}, bool) ->
  {This0#t_compact{read_value = ?CBOOL_NONE}, {ok, Bool}};

read(This0, ubyte) ->
  {This1, {ok, <<Val:8/integer-unsigned-big, _/binary>>}} = read_data(This0, 1),
  {This1, {ok, Val}};

read(This0, byte) ->
  {This1, Bytes} = read_data(This0, 1),
  case Bytes of
    {ok, <<Val:8/integer-signed-big, _/binary>>} -> {This1, {ok, Val}};
    Else -> {This1, Else}
  end;

read(This0, i16) ->
  {This1, {ok, Zigzag}} = read_varint(This0, 0, 0),
  {This1, {ok, from_zigzag(Zigzag)}};

read(This0, ui32) -> read_varint(This0, 0, 0);

read(This0, i32) ->
  {This1, {ok, Zigzag}} = read_varint(This0, 0, 0),
  {This1, {ok, from_zigzag(Zigzag)}};

read(This0, i64) ->
  {This1, {ok, Zigzag}} = read_varint(This0, 0, 0),
  {This1, {ok, from_zigzag(Zigzag)}};

read(This0, double) ->
  {This1, Bytes} = read_data(This0, 8),
  case Bytes of
    {ok, <<Val:64/float-signed-little, _/binary>>} -> {This1, {ok, Val}};
    Else -> {This1, Else}
  end;

% returns a binary directly, call binary_to_list if necessary
read(This0, string) ->
  {This1, {ok, Sz}}  = read(This0, ui32),
  read_data(This1, Sz).

-spec read_data(#t_compact{}, non_neg_integer()) ->
    {#t_compact{}, {ok, binary()} | {error, _Reason}}.
read_data(This, 0) -> {This, {ok, <<>>}};
read_data(This = #t_compact{transport = Trans}, Len) when is_integer(Len) andalso Len > 0 ->
    {NewTransport, Result} = thrift_transport:read(Trans, Len),
    {This#t_compact{transport = NewTransport}, Result}.


%%%% FACTORY GENERATION %%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%

%% returns a (fun() -> thrift_protocol())
new_protocol_factory(TransportFactory, _Options) ->
  F = fun() ->
          case TransportFactory() of
            {ok, Transport} ->
              thrift_compact_protocol:new(
                Transport,
                []);
            {error, Error} ->
              {error, Error}
          end
      end,
  {ok, F}.
