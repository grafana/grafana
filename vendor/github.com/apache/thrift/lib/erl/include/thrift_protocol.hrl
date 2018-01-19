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

-ifndef(THRIFT_PROTOCOL_INCLUDED).
-define(THRIFT_PROTOCOL_INCLUDED, true).

-record(protocol_message_begin, {name, type, seqid}).
-record(protocol_struct_begin, {name}).
-record(protocol_field_begin, {name, type, id}).
-record(protocol_map_begin, {ktype, vtype, size}).
-record(protocol_list_begin, {etype, size}).
-record(protocol_set_begin, {etype, size}).

-type tprot_header_val() :: #protocol_message_begin{}
                          | #protocol_struct_begin{}
                          | #protocol_field_begin{}
                          | #protocol_map_begin{}
                          | #protocol_list_begin{}
                          | #protocol_set_begin{}
                          .
-type tprot_empty_tag() :: message_end
                         | struct_begin
                         | struct_end
                         | field_end
                         | map_end
                         | list_end
                         | set_end
                         .
-type tprot_header_tag() :: message_begin
                          | field_begin
                          | map_begin
                          | list_begin
                          | set_begin
                          .
-type tprot_data_tag() :: ui32
                        | bool
                        | byte
                        | i16
                        | i32
                        | i64
                        | double
                        | string
                        .
-type tprot_cont_tag() :: {list, _Type}
                        | {map, _KType, _VType}
                        | {set, _Type}
                        .


-endif.
