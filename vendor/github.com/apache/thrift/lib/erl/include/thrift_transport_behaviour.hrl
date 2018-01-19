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

%% Signature specifications for transport implementations.

-ifndef(THRIFT_TRANSPORT_BEHAVIOUR_INCLUDED).
-define(THRIFT_TRANSPORT_BEHAVIOUR_INCLUDED, true).

-spec write(state(), iolist() | binary()) -> {state(), ok | {error, _Reason}}.
-spec read(state(), non_neg_integer()) -> {state(), {ok, binary()} | {error, _Reason}}.
-spec flush(state()) -> {state(), ok | {error, _Reason}}.
-spec close(state()) -> {state(), ok | {error, _Reason}}.


-endif.
