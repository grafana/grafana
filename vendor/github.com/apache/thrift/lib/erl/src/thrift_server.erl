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

-module(thrift_server).

-behaviour(gen_server).

%% API
-export([start_link/3, stop/1, take_socket/2]).

%% gen_server callbacks
-export([init/1, handle_call/3, handle_cast/2, handle_info/2,
         terminate/2, code_change/3]).

-define(SERVER, ?MODULE).

-record(state, {listen_socket, acceptor_ref, service, handler}).

%%====================================================================
%% API
%%====================================================================
%%--------------------------------------------------------------------
%% Function: start_link() -> {ok,Pid} | ignore | {error,Error}
%% Description: Starts the server
%%--------------------------------------------------------------------
start_link(Port, Service, HandlerModule) when is_integer(Port), is_atom(HandlerModule) ->
    gen_server:start_link({local, ?SERVER}, ?MODULE, {Port, Service, HandlerModule}, []).

%%--------------------------------------------------------------------
%% Function: stop(Pid) -> ok, {error, Reason}
%% Description: Stops the server.
%%--------------------------------------------------------------------
stop(Pid) when is_pid(Pid) ->
    gen_server:call(Pid, stop).


take_socket(Server, Socket) ->
    gen_server:call(Server, {take_socket, Socket}).


%%====================================================================
%% gen_server callbacks
%%====================================================================

%%--------------------------------------------------------------------
%% Function: init(Args) -> {ok, State} |
%%                         {ok, State, Timeout} |
%%                         ignore               |
%%                         {stop, Reason}
%% Description: Initiates the server
%%--------------------------------------------------------------------
init({Port, Service, Handler}) ->
    {ok, Socket} = gen_tcp:listen(Port,
                                  [binary,
                                   {packet, 0},
                                   {active, false},
                                   {nodelay, true},
                                   {reuseaddr, true}]),
    {ok, Ref} = prim_inet:async_accept(Socket, -1),
    {ok, #state{listen_socket = Socket,
                acceptor_ref = Ref,
                service = Service,
                handler = Handler}}.

%%--------------------------------------------------------------------
%% Function: %% handle_call(Request, From, State) -> {reply, Reply, State} |
%%                                      {reply, Reply, State, Timeout} |
%%                                      {noreply, State} |
%%                                      {noreply, State, Timeout} |
%%                                      {stop, Reason, Reply, State} |
%%                                      {stop, Reason, State}
%% Description: Handling call messages
%%--------------------------------------------------------------------
handle_call(stop, _From, State) ->
    {stop, stopped, ok, State};

handle_call({take_socket, Socket}, {FromPid, _Tag}, State) ->
    Result = gen_tcp:controlling_process(Socket, FromPid),
    {reply, Result, State}.

%%--------------------------------------------------------------------
%% Function: handle_cast(Msg, State) -> {noreply, State} |
%%                                      {noreply, State, Timeout} |
%%                                      {stop, Reason, State}
%% Description: Handling cast messages
%%--------------------------------------------------------------------
handle_cast(_Msg, State) ->
    {noreply, State}.

%%--------------------------------------------------------------------
%% Function: handle_info(Info, State) -> {noreply, State} |
%%                                       {noreply, State, Timeout} |
%%                                       {stop, Reason, State}
%% Description: Handling all non call/cast messages
%%--------------------------------------------------------------------
handle_info({inet_async, ListenSocket, Ref, {ok, ClientSocket}},
            State = #state{listen_socket = ListenSocket,
                           acceptor_ref = Ref,
                           service = Service,
                           handler = Handler}) ->
    case set_sockopt(ListenSocket, ClientSocket) of
        ok ->
            %% New client connected - start processor
            start_processor(ClientSocket, Service, Handler),
            {ok, NewRef} = prim_inet:async_accept(ListenSocket, -1),
            {noreply, State#state{acceptor_ref = NewRef}};
        {error, Reason} ->
            error_logger:error_msg("Couldn't set socket opts: ~p~n",
                                   [Reason]),
            {stop, Reason, State}
    end;

handle_info({inet_async, _ListenSocket, _Ref, Error}, State) ->
    error_logger:error_msg("Error in acceptor: ~p~n", [Error]),
    {stop, Error, State};

handle_info(_Info, State) ->
    {noreply, State}.

%%--------------------------------------------------------------------
%% Function: terminate(Reason, State) -> void()
%% Description: This function is called by a gen_server when it is about to
%% terminate. It should be the opposite of Module:init/1 and do any necessary
%% cleaning up. When it returns, the gen_server terminates with Reason.
%% The return value is ignored.
%%--------------------------------------------------------------------
terminate(_Reason, _State) ->
    ok.

%%--------------------------------------------------------------------
%% Func: code_change(OldVsn, State, Extra) -> {ok, NewState}
%% Description: Convert process state when code is changed
%%--------------------------------------------------------------------
code_change(_OldVsn, State, _Extra) ->
    {ok, State}.

%%--------------------------------------------------------------------
%%% Internal functions
%%--------------------------------------------------------------------
set_sockopt(ListenSocket, ClientSocket) ->
    true = inet_db:register_socket(ClientSocket, inet_tcp),
    case prim_inet:getopts(ListenSocket,
                           [active, nodelay, keepalive, delay_send, priority, tos]) of
        {ok, Opts} ->
            case prim_inet:setopts(ClientSocket, Opts) of
                ok    -> ok;
                Error -> gen_tcp:close(ClientSocket),
                         Error
            end;
        Error ->
            gen_tcp:close(ClientSocket),
            Error
    end.

start_processor(Socket, Service, Handler) ->
    Server = self(),

    ProtoGen = fun() ->
                       % Become the controlling process
                       ok = take_socket(Server, Socket),
                       {ok, SocketTransport} = thrift_socket_transport:new(Socket),
                       {ok, BufferedTransport} = thrift_buffered_transport:new(SocketTransport),
                       {ok, Protocol} = thrift_binary_protocol:new(BufferedTransport),
                       {ok, Protocol}
               end,

    spawn(thrift_processor, init, [{Server, ProtoGen, Service, Handler}]).
