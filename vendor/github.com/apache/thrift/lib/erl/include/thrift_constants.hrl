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

%% TType
-define(tType_STOP, 0).
-define(tType_VOID, 1).
-define(tType_BOOL, 2).
-define(tType_BYTE, 3).
-define(tType_I8, 3).
-define(tType_DOUBLE, 4).
-define(tType_I16, 6).
-define(tType_I32, 8).
-define(tType_I64, 10).
-define(tType_STRING, 11).
-define(tType_STRUCT, 12).
-define(tType_MAP, 13).
-define(tType_SET, 14).
-define(tType_LIST, 15).

% TMessageType
-define(tMessageType_CALL, 1).
-define(tMessageType_REPLY, 2).
-define(tMessageType_EXCEPTION, 3).
-define(tMessageType_ONEWAY, 4).

% TApplicationException
-define(TApplicationException_Structure,
        {struct, [{1, string},
                  {2, i32}]}).

-record('TApplicationException', {message, type}).

-define(TApplicationException_UNKNOWN, 0).
-define(TApplicationException_UNKNOWN_METHOD, 1).
-define(TApplicationException_INVALID_MESSAGE_TYPE, 2).
-define(TApplicationException_WRONG_METHOD_NAME, 3).
-define(TApplicationException_BAD_SEQUENCE_ID, 4).
-define(TApplicationException_MISSING_RESULT, 5).
-define(TApplicationException_INTERNAL_ERROR, 6).
-define(TApplicationException_PROTOCOL_ERROR, 7).
-define(TApplicationException_INVALID_TRANSFORM, 8).
-define(TApplicationException_INVALID_PROTOCOL, 9).
-define(TApplicationException_UNSUPPORTED_CLIENT_TYPE, 10).

-define (MULTIPLEXED_SERVICE_SEPARATOR, ":").
-define (MULTIPLEXED_ERROR_HANDLER_KEY, "error_handler").
