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

-module(thrift_reconnecting_client).

-behaviour(gen_server).

%% API
-export([ call/3,
          get_stats/1,
          get_and_reset_stats/1 ]).

-export([ start_link/6 ]).

%% gen_server callbacks
-export([ init/1,
          handle_call/3,
          handle_cast/2,
          handle_info/2,
          terminate/2,
          code_change/3 ]).

-record( state, { client = nil, 
                  host,
                  port,
                  thrift_svc,
                  thrift_opts,
                  reconn_min,
                  reconn_max,
                  reconn_time = 0,
                  op_cnt_dict,
                  op_time_dict } ).

%%====================================================================
%% API
%%====================================================================
%%--------------------------------------------------------------------
%% Function: start_link() -> {ok,Pid} | ignore | {error,Error}
%% Description: Starts the server
%%--------------------------------------------------------------------
start_link( Host, Port,
            ThriftSvc, ThriftOpts,
            ReconnMin, ReconnMax ) ->
  gen_server:start_link( ?MODULE,
                         [ Host, Port,
                           ThriftSvc, ThriftOpts,
                           ReconnMin, ReconnMax ],
                         [] ).

call( Pid, Op, Args ) ->
  gen_server:call( Pid, { call, Op, Args } ).

get_stats( Pid ) ->
  gen_server:call( Pid, get_stats ).

get_and_reset_stats( Pid ) ->
  gen_server:call( Pid, get_and_reset_stats ).

%%====================================================================
%% gen_server callbacks
%%====================================================================

%%--------------------------------------------------------------------
%% Function: init(Args) -> {ok, State} |
%%                         {ok, State, Timeout} |
%%                         ignore               |
%%                         {stop, Reason}
%% Description: Start the server.
%%--------------------------------------------------------------------
init( [ Host, Port, TSvc, TOpts, ReconnMin, ReconnMax ] ) ->
  process_flag( trap_exit, true ),

  State = #state{ host         = Host,
                  port         = Port,
                  thrift_svc   = TSvc,
                  thrift_opts  = TOpts,
                  reconn_min   = ReconnMin,
                  reconn_max   = ReconnMax,
                  op_cnt_dict  = dict:new(),
                  op_time_dict = dict:new() },

  { ok, try_connect( State ) }.

%%--------------------------------------------------------------------
%% Function: %% handle_call(Request, From, State) -> {reply, Reply, State} |
%%                                                   {reply, Reply, State, Timeout} |
%%                                                   {noreply, State} |
%%                                                   {noreply, State, Timeout} |
%%                                                   {stop, Reason, Reply, State} |
%%                                                   {stop, Reason, State}
%% Description: Handling call messages
%%--------------------------------------------------------------------
handle_call( { call, Op, _ },
             _From,
             State = #state{ client = nil } ) ->
  { reply, { error, noconn }, incr_stats( Op, "failfast", 1, State ) };

handle_call( { call, Op, Args },
             _From,
             State=#state{ client = Client } ) ->

  Timer = timer_fun(),
  Result = ( catch thrift_client:call( Client, Op, Args) ),
  Time = Timer(),

  case Result of
    { C, { ok, Reply } } ->
      S = incr_stats( Op, "success", Time, State#state{ client = C } ),
      { reply, {ok, Reply }, S };
    { _, { E, Msg } } when E == error; E == exception ->
      S = incr_stats( Op, "error", Time, try_connect( State ) ),
      { reply, { E, Msg }, S };
    Other ->
      S = incr_stats( Op, "error", Time, try_connect( State ) ),
      { reply, Other, S }
  end;

handle_call( get_stats,
             _From,
             State = #state{} ) ->
  { reply, stats( State ), State };

handle_call( get_and_reset_stats,
             _From,
             State = #state{} ) ->
  { reply, stats( State ), reset_stats( State ) }.

%%--------------------------------------------------------------------
%% Function: handle_cast(Msg, State) -> {noreply, State} |
%%                                      {noreply, State, Timeout} |
%%                                      {stop, Reason, State}
%% Description: Handling cast messages
%%--------------------------------------------------------------------
handle_cast( _Msg, State ) ->
  { noreply, State }.

%%--------------------------------------------------------------------
%% Function: handle_info(Info, State) -> {noreply, State} |
%%                                       {noreply, State, Timeout} |
%%                                       {stop, Reason, State}
%% Description: Handling all non call/cast messages
%%--------------------------------------------------------------------
handle_info( try_connect, State ) ->
  { noreply, try_connect( State ) };

handle_info( _Info, State ) ->
  { noreply, State }.

%%--------------------------------------------------------------------
%% Function: terminate(Reason, State) -> void()
%% Description: This function is called by a gen_server when it is about to
%% terminate. It should be the opposite of Module:init/1 and do any necessary
%% cleaning up. When it returns, the gen_server terminates with Reason.
%% The return value is ignored.
%%--------------------------------------------------------------------
terminate( _Reason, #state{ client = Client } ) ->
  thrift_client:close( Client ),
  ok.

%%--------------------------------------------------------------------
%% Func: code_change(OldVsn, State, Extra) -> {ok, NewState}
%% Description: Convert process state when code is changed
%%--------------------------------------------------------------------
code_change( _OldVsn, State, _Extra ) ->
  { ok, State }.

%%--------------------------------------------------------------------
%%% Internal functions
%%--------------------------------------------------------------------
try_connect( State = #state{ client      = OldClient,
                             host        = Host,
                             port        = Port,
                             thrift_svc  = TSvc,
                             thrift_opts = TOpts } ) ->

  case OldClient of
    nil -> ok;
    _   -> ( catch thrift_client:close( OldClient ) )
  end,

  case catch thrift_client_util:new( Host, Port, TSvc, TOpts ) of
    { ok, Client } ->
      State#state{ client = Client, reconn_time = 0 };
    { E, Msg } when E == error; E == exception ->
      ReconnTime = reconn_time( State ),
      error_logger:error_msg( "[~w] ~w connect failed (~w), trying again in ~w ms~n",
                              [ self(), TSvc, Msg, ReconnTime ] ),
      erlang:send_after( ReconnTime, self(), try_connect ),
      State#state{ client = nil, reconn_time = ReconnTime }
  end.


reconn_time( #state{ reconn_min = ReconnMin, reconn_time = 0 } ) ->
  ReconnMin;
reconn_time( #state{ reconn_max = ReconnMax, reconn_time = ReconnMax } ) ->
  ReconnMax;
reconn_time( #state{ reconn_max = ReconnMax, reconn_time = R } ) ->
  Backoff = 2 * R,
  case Backoff > ReconnMax of
    true  -> ReconnMax;
    false -> Backoff
  end.

-ifdef(time_correction).
timer_fun() ->
  T1 = erlang:monotonic_time(),
  fun() ->
    T2 = erlang:monotonic_time(),
    erlang:convert_time_unit(T2 - T1, native, micro_seconds)
  end.
-else.
timer_fun() ->
  T1 = erlang:now(),
  fun() ->
    T2 = erlang:now(),
    timer:now_diff(T2, T1)
  end.
-endif.

incr_stats( Op, Result, Time,
            State = #state{ op_cnt_dict  = OpCntDict,
                            op_time_dict = OpTimeDict } ) ->
  Key = lists:flatten( [ atom_to_list( Op ), [ "_" | Result ] ] ),
  State#state{ op_cnt_dict  = dict:update_counter( Key, 1, OpCntDict ),
               op_time_dict = dict:update_counter( Key, Time, OpTimeDict ) }.


stats( #state{ thrift_svc   = TSvc,
               op_cnt_dict  = OpCntDict,
               op_time_dict = OpTimeDict } ) ->
  Svc = atom_to_list(TSvc),

  F = fun( Key, Count, Stats ) ->
        Name = lists:flatten( [ Svc, [ "_" | Key ] ] ),
        Micros = dict:fetch( Key, OpTimeDict ),
        [ { Name, Count, Micros } | Stats ]
      end,

  dict:fold( F, [], OpCntDict ).

reset_stats( State = #state{} ) ->
  State#state{ op_cnt_dict = dict:new(), op_time_dict = dict:new() }.
