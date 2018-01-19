-module(multiplexing_test).

-include_lib("eunit/include/eunit.hrl").

-export([
     handle_function/2
    ,handle_error/2
]).

start_multiplexed_server_test() ->

    Port = 9090,
    Services = [
                {"Multiplexing_Calculator",    multiplexing__calculator_thrift},
                {"Multiplexing_WeatherReport", multiplexing__weather_report_thrift}
               ],

    {ok, Pid} = thrift_socket_server:start([
        {ip, "127.0.0.1"},
        {port, Port},
        {name, ?MODULE},
        {service, Services},
        {handler, [
            {"error_handler",              ?MODULE},
            {"Multiplexing_Calculator",    ?MODULE},
            {"Multiplexing_WeatherReport", ?MODULE}
        ]}
     ]),

    {ok, [{"Multiplexing_Calculator", CalculatorClient0},
          {"Multiplexing_WeatherReport", WeatherReportClient0}]} = thrift_client_util:new_multiplexed("127.0.0.1", Port, Services, []),

    ?assertMatch({_, {error, {bad_args, _, _}}}, thrift_client:call(WeatherReportClient0, getTemperature, [1])),
    ?assertMatch({_, {error, {bad_args, _, _}}}, thrift_client:call(CalculatorClient0, add, [1])),
    ?assertMatch({_, {error, {bad_args, _, _}}}, thrift_client:call(CalculatorClient0, add, [1,1,1])),

    ?assertMatch({_, {error, {no_function, _}}}, thrift_client:call(CalculatorClient0, getTemperature, [])),
    ?assertMatch({_, {error, {no_function, _}}}, thrift_client:call(WeatherReportClient0, add, [41, 1])),

    ?assertMatch({_, {ok, 42}}, thrift_client:call(CalculatorClient0, add, [41, 1])),
    ?assertMatch({_, {ok, 42.0}}, thrift_client:call(WeatherReportClient0, getTemperature, [])),

    thrift_socket_server:stop(Pid).

%% HANDLE FUNCTIONS

%% Calculator handles
handle_function(add, {X, Y}) ->
    {reply, X + Y};

%% WeatherReport handles
handle_function(getTemperature, {}) ->
    {reply, 42.0}.

handle_error(_F, _Reason) ->
%%     ?debugHere, ?debugVal({_F, _Reason}),
    ok.