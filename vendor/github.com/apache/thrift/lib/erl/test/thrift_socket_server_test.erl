-module (thrift_socket_server_test).

-include_lib("eunit/include/eunit.hrl").

-include ("thrift_constants.hrl").

parse_handler_options_test_() ->
    CorrectServiceHandlerOptionList = [{?MULTIPLEXED_ERROR_HANDLER_KEY, ?MODULE}, {"Service1", ?MODULE}, {"Service2", ?MODULE}],
    MissingErrorHandlerOptionList   = [{"Service1", ?MODULE}, {"Service2", ?MODULE}],
    WrongService2HandlerOptionList  = [{?MULTIPLEXED_ERROR_HANDLER_KEY, ?MODULE}, {"Service1", ?MODULE}, {"Service2", "Module"}],
    WrongServiceKeyOptionList       = [{?MULTIPLEXED_ERROR_HANDLER_KEY, ?MODULE}, {'service1', ?MODULE}, {"Service2", ?MODULE}],
    CorrectHandlerTestFunction = fun() ->
        ?assertMatch({thrift_socket_server,_,_,_,_,_,_,_,_,_,_,_,_,_}, thrift_socket_server:parse_options([{handler, CorrectServiceHandlerOptionList}])),
        {thrift_socket_server,_,_, HandlerList,_,_,_,_,_,_,_,_,_,_} = thrift_socket_server:parse_options([{handler, CorrectServiceHandlerOptionList}]),
        lists:foreach(fun
            ({ServiceName, HandlerModule}) ->
                ?assertMatch({ok, HandlerModule} when is_atom(HandlerModule), thrift_multiplexed_map_wrapper:find(ServiceName, HandlerList))
        end, CorrectServiceHandlerOptionList)
    end,
    [
     {"Bad argument for the handler option", ?_assertThrow(_, thrift_socket_server:parse_options([{handler, []}]))},
     {"Try to parse the handler option twice", ?_assertThrow(_, thrift_socket_server:parse_options([{handler, ?MODULE}, {handler, CorrectServiceHandlerOptionList}]))},
     {"Parse the handler option as a non multiplexed service handler", ?_assertMatch({thrift_socket_server,_,_,?MODULE,_,_,_,_,_,_,_,_,_,_}, thrift_socket_server:parse_options([{handler, ?MODULE}]))},
     {"No error handler was defined", ?_assertThrow(_, thrift_socket_server:parse_options([{handler, MissingErrorHandlerOptionList}]))},
     {"Bad handler module for Service2", ?_assertThrow(_, thrift_socket_server:parse_options([{handler, WrongService2HandlerOptionList}]))},
     {"Bad service key for Service1", ?_assertThrow(_, thrift_socket_server:parse_options([{handler, WrongServiceKeyOptionList}]))},
     {"Try to parse a correct handler option list", CorrectHandlerTestFunction}
    ].

parse_service_options_test_() ->
    CorrectServiceModuleOptionList = [{"Service1", ?MODULE}, {"Service2", ?MODULE}],
    WrongService2ModuleOptionList  = [{"Service1", ?MODULE}, {"Service2", "thrift_service_module"}],
    WrongServiceKeyOptionList       = [{'service1', ?MODULE}, {"Service2", ?MODULE}],
    CorrectServiceModuleTestFunction = fun() ->
        ?assertMatch({thrift_socket_server,_,_,_,_,_,_,_,_,_,_,_,_,_}, thrift_socket_server:parse_options([{service, CorrectServiceModuleOptionList}])),
        {thrift_socket_server,_, ServiceModuleList,_,_,_,_,_,_,_,_,_,_,_} = thrift_socket_server:parse_options([{service, CorrectServiceModuleOptionList}]),
        lists:foreach(fun
            ({ServiceName, ServiceModule}) ->
                ?assertMatch({ok, ServiceModule} when is_atom(ServiceModule), thrift_multiplexed_map_wrapper:find(ServiceName, ServiceModuleList))
        end, CorrectServiceModuleOptionList)
    end,
    [
     {"Bad argument for the service option", ?_assertThrow(_, thrift_socket_server:parse_options([{service, []}]))},
     {"Try to parse the service option twice", ?_assertThrow(_, thrift_socket_server:parse_options([{service, ?MODULE}, {service, CorrectServiceModuleOptionList}]))},
     {"Parse a service module for a non multiplexed service", ?_assertMatch({thrift_socket_server,_,?MODULE,_,_,_,_,_,_,_,_,_,_,_}, thrift_socket_server:parse_options([{service, ?MODULE}]))},
     {"Bad service module for Service2", ?_assertThrow(_, thrift_socket_server:parse_options([{service, WrongService2ModuleOptionList}]))},
     {"Bad service key for Service1", ?_assertThrow(_, thrift_socket_server:parse_options([{service, WrongServiceKeyOptionList}]))},
     {"Try to parse a correct service option list", CorrectServiceModuleTestFunction}
    ].
