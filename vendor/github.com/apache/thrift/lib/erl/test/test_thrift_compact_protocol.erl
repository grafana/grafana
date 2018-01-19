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

-module(test_thrift_compact_protocol).
-include_lib("eunit/include/eunit.hrl").
-include("thrift_constants.hrl").
-include("thrift_protocol.hrl").


new(Transport) -> thrift_compact_protocol:new(Transport).
new() ->
  {ok, Transport} = thrift_membuffer_transport:new(),
  thrift_compact_protocol:new(Transport).

new_test() ->
  new(thrift_membuffer_transport:new()).

write(This, Value) -> thrift_protocol:write(This, Value).
read(This, Type) -> thrift_protocol:read(This, Type).

str(This0, Value0) ->
  {This1, ok} = write(This0, {string, Value0}),
  {This2, {ok, Value1}} = read(This1, string),
  ?assertEqual(Value0, binary_to_list(Value1)),
  {This2, ok}.
string_test() ->
  {ok, This0} = new(),
  {This1, ok} = str(This0, "aaa"),
  {This2, ok} = str(This1, ""),
  {This2, ok}.

round_trip(This0, Type, Value0) ->
  {This1, ok} = write(This0, {Type, Value0}),
  {This2, {ok, Value1}} = read(This1, Type),
  ?assertEqual(Value0, Value1),
  {This2, ok}.

bool_test() ->
  {ok, This0} = new(),
  {This1, ok} = round_trip(This0, bool, true),
  {This2, ok} = round_trip(This1, bool, false),
  {This2, ok}.

byte(This0, Value0) -> round_trip(This0, byte, Value0).
byte_test() ->
  {ok, This0} = new(),
  {This1, ok} = byte(This0, 0),
  {This2, ok} = byte(This1, 42),
  {This3, ok} = byte(This2, -1),
  {This4, ok} = byte(This3, -128),
  {This4, ok}.

i16(This0, Value0) -> round_trip(This0, i16, Value0).
i16_test() ->
  {ok, This0} = new(),
  {This1, ok} = i16(This0, 0),
  {This2, ok} = i16(This1, 42),
  {This3, ok} = i16(This2, 30000),
  {This4, ok} = i16(This3, -1),
  {This5, ok} = i16(This4, -128),
  {This6, ok} = i16(This5, -30000),
  {This6, ok}.

i32(This0, Value0) -> round_trip(This0, i32, Value0).
i32_test() ->
  {ok, This0} = new(),
  {This1, ok} = i32(This0, 0),
  {This2, ok} = i32(This1, 42),
  {This3, ok} = i32(This2, 30000),
  {This4, ok} = i32(This3, 2000000002),
  {This5, ok} = i32(This4, -1),
  {This6, ok} = i32(This5, -128),
  {This7, ok} = i32(This6, -30000),
  {This8, ok} = i32(This7, -2000000002),
  {This8, ok}.

i64(This0, Value0) -> round_trip(This0, i64, Value0).
i64_test() ->
  {ok, This0} = new(),
  {This1, ok} = i64(This0, 0),
  {This2, ok} = i64(This1, 42),
  {This3, ok} = i64(This2, 30000),
  {This4, ok} = i64(This3, 2000000002),
  {This5, ok} = i64(This4, 100000000000000064),
  {This6, ok} = i64(This5, -1),
  {This7, ok} = i64(This6, -128),
  {This8, ok} = i64(This7, -30000),
  {This9, ok} = i64(This8, -2000000002),
  {This10, ok} = i64(This9, -100000000000000064),
  {This10, ok}.

struct_test() ->
  {ok, P0} = new(),
  {P1, ok} = write(P0, #protocol_message_begin{ name = "Message1", type = ?tType_I8, seqid = 3}),
  {P2, ok} = write(P1, #protocol_struct_begin{}),
  {P3, ok} = write(P2, #protocol_field_begin{ name = "field1", type = ?tType_I8, id = 1}),
  {P4, ok} = write(P3, {byte, 42}),
  {P5, ok} = write(P4, field_end),
  {P6, ok} = write(P5, #protocol_field_begin{ name = "field2", type = ?tType_I8, id = 14}),
  {P7, ok} = write(P6, {byte, 3}),
  {P8, ok} = write(P7, field_end),
  {P9, ok} = write(P8, #protocol_field_begin{ name = "field3", type = ?tType_I8, id = 42}),
  {P10, ok} = write(P9, {byte, 8}),
  {P11, ok} = write(P10, field_end),
  {P12, ok} = write(P11, field_stop),
  {P13, ok} = write(P12, struct_end),
  {P14, ok} = write(P13, message_end),

  {P15, #protocol_message_begin{ name = "Message1", type = ?tType_I8, seqid = 3}} = read(P14, message_begin),
  {P16, ok} = read(P15, struct_begin),
  {P17, #protocol_field_begin{ type = ?tType_I8, id = 1 }} = read(P16, field_begin),
  {P18, {ok, 42}} = read(P17, byte),
  {P19, ok} = read(P18, field_end),
  {P20, #protocol_field_begin{ type = ?tType_I8, id = 14 }} = read(P19, field_begin),
  {P21, {ok, 3}} = read(P20, byte),
  {P22, ok} = read(P21, field_end),
  {P23, #protocol_field_begin{ type = ?tType_I8, id = 42 }} = read(P22, field_begin),
  {P24, {ok, 8}} = read(P23, byte),
  {P25, ok} = read(P24, field_end),
  {P26, #protocol_field_begin{ type = ?tType_STOP}} = read(P25, field_begin),
  {P27, ok} = read(P26, struct_end),
  {P28, ok} = read(P27, message_end),
  {P28, ok}.

bool_field_test() ->
  {ok, P0} = new(),
  {P1, ok} = write(P0, #protocol_message_begin{ name = "Message1", type = ?tType_I8, seqid = 3}),
  {P2, ok} = write(P1, #protocol_struct_begin{}),
  {P3, ok} = write(P2, #protocol_field_begin{ name = "field1", type = ?tType_BOOL, id = 1}),
  {P4, ok} = write(P3, {bool, true}),
  {P5, ok} = write(P4, field_end),
  {P6, ok} = write(P5, #protocol_field_begin{ name = "field2", type = ?tType_BOOL, id = 14}),
  {P7, ok} = write(P6, {bool, false}),
  {P8, ok} = write(P7, field_end),
  {P9, ok} = write(P8, #protocol_field_begin{ name = "field3", type = ?tType_BOOL, id = 42}),
  {P10, ok} = write(P9, {bool, true}),
  {P11, ok} = write(P10, field_end),
  {P12, ok} = write(P11, field_stop),
  {P13, ok} = write(P12, struct_end),
  {P14, ok} = write(P13, message_end),

  {P15, #protocol_message_begin{ name = "Message1", type = ?tType_I8, seqid = 3}} = read(P14, message_begin),
  {P16, ok} = read(P15, struct_begin),
  {P17, #protocol_field_begin{ type = ?tType_BOOL, id = 1 }} = read(P16, field_begin),
  {P18, {ok, true}} = read(P17, bool),
  {P19, ok} = read(P18, field_end),
  {P20, #protocol_field_begin{ type = ?tType_BOOL, id = 14 }} = read(P19, field_begin),
  {P21, {ok, false}} = read(P20, bool),
  {P22, ok} = read(P21, field_end),
  {P23, #protocol_field_begin{ type = ?tType_BOOL, id = 42 }} = read(P22, field_begin),
  {P24, {ok, true}} = read(P23, bool),
  {P25, ok} = read(P24, field_end),
  {P26, #protocol_field_begin{ type = ?tType_STOP}} = read(P25, field_begin),
  {P27, ok} = read(P26, struct_end),
  {P28, ok} = read(P27, message_end),
  {P28, ok}.

nesting_test() ->
  {ok, P0} = new(),
  {P1, ok} = write(P0, #protocol_message_begin{ name = "Message1", type = ?tType_I8, seqid = 3}),
  {P2, ok} = write(P1, #protocol_struct_begin{}),
  {P3, ok} = write(P2, #protocol_field_begin{ name = "field1", type = ?tType_BOOL, id = 14}),
  {P4, ok} = write(P3, {bool, true}),
  {P5, ok} = write(P4, field_end),

  {P6, ok} = write(P5, #protocol_field_begin{ name = "field2", type = ?tType_STRUCT, id = 28}),
  {P7, ok} = write(P6, #protocol_struct_begin{}),
  {P8, ok} = write(P7, #protocol_field_begin{ name = "field2_1", type = ?tType_BOOL, id = 30000}),
  {P9, ok} = write(P8, {bool, false}),
  {P10, ok} = write(P9, field_end),
  {P11, ok} = write(P10, field_stop),
  {P12, ok} = write(P11, struct_end),
  {P13, ok} = write(P12, field_end),

  {P14, ok} = write(P13, #protocol_field_begin{ name = "field3", type = ?tType_BOOL, id = 42}),
  {P15, ok} = write(P14, {bool, true}),
  {P16, ok} = write(P15, field_end),
  {P17, ok} = write(P16, field_stop),
  {P18, ok} = write(P17, struct_end),
  {P19, ok} = write(P18, message_end),

  {P20, #protocol_message_begin{ name = "Message1", type = ?tType_I8, seqid = 3}} = read(P19, message_begin),
  {P21, ok} = read(P20, struct_begin),
  {P22, #protocol_field_begin{ type = ?tType_BOOL, id = 14 }} = read(P21, field_begin),
  {P23, {ok, true}} = read(P22, bool),
  {P24, ok} = read(P23, field_end),

  {P25, #protocol_field_begin{ type = ?tType_STRUCT, id = 28 }} = read(P24, field_begin),
  {P26, ok} = read(P25, struct_begin),
  {P27, #protocol_field_begin{ type = ?tType_BOOL, id = 30000 }} = read(P26, field_begin),
  {P28, {ok, false}} = read(P27, bool),
  {P29, ok} = read(P28, field_end),
  {P30, #protocol_field_begin{ type = ?tType_STOP }} = read(P29, field_begin),
  {P31, ok} = read(P30, struct_end),
  {P32, ok} = read(P31, field_end),

  {P33, #protocol_field_begin{ type = ?tType_BOOL, id = 42 }} = read(P32, field_begin),
  {P34, {ok, true}} = read(P33, bool),
  {P35, ok} = read(P34, field_end),
  {P36, #protocol_field_begin{ type = ?tType_STOP }} = read(P35, field_begin),
  {P37, ok} = read(P36, struct_end),
  {P38, ok} = read(P37, message_end),
  {P38, ok}.
