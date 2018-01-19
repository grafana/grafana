-module(test_thrift_1151).

-include("gen-erl/thrift1151_types.hrl").

-ifdef(TEST).
-include_lib("eunit/include/eunit.hrl").

unmatched_struct_test() ->
  S1 = #'StructC'{x=#'StructB'{x=1}},
  {ok, Transport} = thrift_memory_buffer:new(),
  {ok, Protocol} = thrift_binary_protocol:new(Transport),
  ?assertException(
    error,
    struct_unmatched,
    thrift_protocol:write(
      Protocol,
      {{struct, element(2, thrift1151_types:struct_info('StructC'))}, S1}
    )
  ).

badarg_test() ->
  S2 = #'StructC'{x=#'StructA'{x="1"}},
  {ok, Transport} = thrift_memory_buffer:new(),
  {ok, Protocol} = thrift_binary_protocol:new(Transport),
  ?assertException(
    error,
    badarg,
    thrift_protocol:write(
      Protocol,
      {{struct, element(2, thrift1151_types:struct_info('StructC'))}, S2}
    )
  ).

-endif.
