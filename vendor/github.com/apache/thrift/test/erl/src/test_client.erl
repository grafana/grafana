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

-module(test_client).

-export([start/0, start/1]).

-include("gen-erl/thrift_test_types.hrl").

-record(options, {port = 9090,
                  client_opts = []}).

parse_args(Args) -> parse_args(Args, #options{}).
parse_args([], Opts) ->
  Opts;
parse_args([Head | Rest], Opts) ->
    NewOpts =
        case Head of
            "--port=" ++ Port ->
                case string:to_integer(Port) of
                  {IntPort,_} when is_integer(IntPort) ->
                    Opts#options{port = IntPort};
                  _Else ->
                    erlang:error({bad_arg, Head})
                end;
            "--transport=" ++ Trans ->
                % TODO: Enable Buffered and HTTP transport
                case Trans of
                    "framed" ->
                        Opts#options{client_opts = [{framed, true} | Opts#options.client_opts]};
                    _Else ->
                        Opts
                end;
            "--ssl" ->
                ssl:start(),
                SslOptions =
                    {ssloptions, [
                        {certfile, "../keys/client.crt"}
                        ,{keyfile, "../keys/server.key"}
                    ]},
                Opts#options{client_opts = [{ssltransport, true} | [SslOptions | Opts#options.client_opts]]};
            "--protocol=" ++ Proto ->
                Opts#options{client_opts = [{protocol, list_to_atom(Proto)}]};
            _Else ->
                erlang:error({bad_arg, Head})
        end,
    parse_args(Rest, NewOpts).

start() -> start(init:get_plain_arguments()).
start(Args) ->
  #options{port = Port, client_opts = ClientOpts} = parse_args(Args),
  {ok, Client0} = thrift_client_util:new(
    "127.0.0.1", Port, thrift_test_thrift, ClientOpts),

  DemoXtruct = #'thrift.test.Xtruct'{
                  string_thing = <<"Zero">>,
                  byte_thing = 1,
                  i32_thing = 9128361,
                  i64_thing = 9223372036854775807},

  DemoNest = #'thrift.test.Xtruct2'{
    byte_thing = 7,
    struct_thing = DemoXtruct,
    % Note that we don't set i32_thing, it will come back as undefined
    % from the Python server, but 0 from the C++ server, since it is not
    % optional
    i32_thing = 2},

  % Is it safe to match these things?
  DemoDict = dict:from_list([ {Key, Key-10} || Key <- lists:seq(0,10) ]),
  DemoSet = sets:from_list([ Key || Key <- lists:seq(-3,3) ]),

  DemoInsane = #'thrift.test.Insanity'{
    userMap = dict:from_list([{?THRIFT_TEST_NUMBERZ_FIVE, 5000}]),
    xtructs = [#'thrift.test.Xtruct'{ string_thing = <<"Truck">>, byte_thing = 8, i32_thing = 8, i64_thing = 8}]},

  error_logger:info_msg("testVoid"),
  {Client01, {ok, ok}} = thrift_client:call(Client0, testVoid, []),

  error_logger:info_msg("testString"),
  {Client02, {ok, <<"Test">>}}      = thrift_client:call(Client01, testString, ["Test"]),
  error_logger:info_msg("testString"),
  {Client03, {ok, <<"Test">>}}      = thrift_client:call(Client02, testString, [<<"Test">>]),
  error_logger:info_msg("testByte"),
  {Client04, {ok, 63}}              = thrift_client:call(Client03, testByte, [63]),
  error_logger:info_msg("testI32"),
  {Client05, {ok, -1}}              = thrift_client:call(Client04, testI32, [-1]),
  error_logger:info_msg("testI32"),
  {Client06, {ok, 0}}               = thrift_client:call(Client05, testI32, [0]),
  error_logger:info_msg("testI64"),
  {Client07, {ok, -34359738368}}    = thrift_client:call(Client06, testI64, [-34359738368]),
  error_logger:info_msg("testDouble"),
  {Client08, {ok, -5.2098523}}      = thrift_client:call(Client07, testDouble, [-5.2098523]),
  %% TODO: add testBinary() call
  error_logger:info_msg("testStruct"),
  {Client09, {ok, DemoXtruct}}      = thrift_client:call(Client08, testStruct, [DemoXtruct]),
  error_logger:info_msg("testNest"),
  {Client10, {ok, DemoNest}}        = thrift_client:call(Client09, testNest, [DemoNest]),
  error_logger:info_msg("testMap"),
  {Client11, {ok, DemoDict}}        = thrift_client:call(Client10, testMap, [DemoDict]),
  error_logger:info_msg("testSet"),
  {Client12, {ok, DemoSet}}         = thrift_client:call(Client11, testSet, [DemoSet]),
  error_logger:info_msg("testList"),
  {Client13, {ok, [-1,2,3]}}        = thrift_client:call(Client12, testList, [[-1,2,3]]),
  error_logger:info_msg("testEnum"),
  {Client14, {ok, 1}}               = thrift_client:call(Client13, testEnum, [?THRIFT_TEST_NUMBERZ_ONE]),
  error_logger:info_msg("testTypedef"),
  {Client15, {ok, 309858235082523}} = thrift_client:call(Client14, testTypedef, [309858235082523]),
  error_logger:info_msg("testInsanity"),
  {Client16, {ok, InsaneResult}}    = thrift_client:call(Client15, testInsanity, [DemoInsane]),
  io:format("~p~n", [InsaneResult]),

  {Client17, {ok, #'thrift.test.Xtruct'{string_thing = <<"Message">>}}} =
    thrift_client:call(Client16, testMultiException, ["Safe", "Message"]),

  Client18 =
    try
      {ClientS1, Result1} = thrift_client:call(Client17, testMultiException, ["Xception", "Message"]),
      io:format("Unexpected return! ~p~n", [Result1]),
      ClientS1
    catch
      throw:{ClientS2, {exception, ExnS1 = #'thrift.test.Xception'{}}} ->
        #'thrift.test.Xception'{errorCode = 1001, message = <<"This is an Xception">>} = ExnS1,
        ClientS2;
      throw:{ClientS2, {exception, _ExnS1 = #'thrift.test.Xception2'{}}} ->
        io:format("Wrong exception type!~n", []),
        ClientS2
    end,

  Client19 =
    try
      {ClientS3, Result2} = thrift_client:call(Client18, testMultiException, ["Xception2", "Message"]),
      io:format("Unexpected return! ~p~n", [Result2]),
      ClientS3
    catch
      throw:{ClientS4, {exception, _ExnS2 = #'thrift.test.Xception'{}}} ->
        io:format("Wrong exception type!~n", []),
        ClientS4;
      throw:{ClientS4, {exception, ExnS2 = #'thrift.test.Xception2'{}}} ->
        #'thrift.test.Xception2'{errorCode = 2002,
                   struct_thing = #'thrift.test.Xtruct'{
                     string_thing = <<"This is an Xception2">>}} = ExnS2,
        ClientS4
    end,

  %% Use deprecated erlang:now until we start requiring OTP18
  %% Started = erlang:monotonic_time(milli_seconds),
  {_, StartSec, StartUSec} = erlang:now(),
  error_logger:info_msg("testOneway"),
  {Client20, {ok, ok}} = thrift_client:call(Client19, testOneway, [1]),
  {_, EndSec, EndUSec} = erlang:now(),
  Elapsed = (EndSec - StartSec) * 1000 + (EndUSec - StartUSec) / 1000,
  if
    Elapsed > 1000 -> exit(1);
    true -> true
  end,

  thrift_client:close(Client20).
