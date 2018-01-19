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

-module(name_conflict_test).
-compile(export_all).

-include_lib("eunit/include/eunit.hrl").

-include("gen-erl/name_conflict_test_constants.hrl").

record_generation_test_() ->
  [
    {"using record", ?_assertMatch(
      {using, _, _},
      #using{single=null,integer=null}
    )},
    {"delegate record", ?_assertMatch(
      {delegate, _, _},
      #delegate{partial=null,delegate=null}
    )},
    {"get record", ?_assertMatch(
      {get, _},
      #get{sbyte=null}
    )},
    {"partial record", ?_assertMatch(
      {partial, _, _, _},
      #partial{using=null}
    )},
    {"ClassAndProp record", ?_assertMatch(
      {'ClassAndProp', _, _, _, _},
      #'ClassAndProp'{
        'ClassAndProp'=null,
        'ClassAndProp_'=null,
        'ClassAndProp__'=null,
        'ClassAndProper'=null
      }
    )},
    {"second_chance record", ?_assertMatch(
      {second_chance, _, _, _, _},
      #second_chance{
        'SECOND_CHANCE'=null,
        'SECOND_CHANCE_'=null,
        'SECOND_CHANCE__'=null,
        'SECOND_CHANCES'=null
      }
    )},
    {"NOW_EAT_THIS record", ?_assertMatch(
      {'NOW_EAT_THIS', _, _, _, _},
      #'NOW_EAT_THIS'{
        now_eat_this=null,
        now_eat_this_=null,
        now_eat_this__=null,
        now_eat_this_and_this=null
      }
    )},
    {"TheEdgeCase record", ?_assertMatch(
      {'TheEdgeCase', _, _, _, _, _, _},
      #'TheEdgeCase'{
        theEdgeCase=null,
        theEdgeCase_=null,
        theEdgeCase__=null,
        'TheEdgeCase'=null,
        'TheEdgeCase_'=null,
        'TheEdgeCase__'=null
      }
    )},
    {"Tricky_ record", ?_assertMatch(
      {'Tricky_', _, _},
      #'Tricky_'{tricky=null,'Tricky'=null}
    )},
    {"Nested record", ?_assertMatch(
      {'Nested', _, _, _, _, _, _},
      #'Nested'{
        'ClassAndProp'=null,
        second_chance=null,
        'NOW_EAT_THIS'=null,
        'TheEdgeCase'=null,
        'Tricky_'=null,
        'Nested'=null
      }
    )},
    {"Problem_ record", ?_assertMatch(
      {'Problem_', _, _},
      #'Problem_'{problem=null,'Problem'=null}
    )}
  ].

struct_info_test_() ->
  [
    {"using definition", ?_assertEqual(
      {struct, [{1, double},{2, double}]},
      name_conflict_test_types:struct_info(using)
    )},
    {"delegate definition", ?_assertEqual(
      {struct, [
        {1, string},
        {2, {struct, {name_conflict_test_types, delegate}}}
      ]},
      name_conflict_test_types:struct_info(delegate)
    )},
    {"get definition", ?_assertEqual(
      {struct, [{1, bool}]},
      name_conflict_test_types:struct_info(get)
    )},
    {"partial definition", ?_assertEqual(
      {struct, [
        {1, {struct, {name_conflict_test_types, using}}},
        {2, bool},
        {3, bool}
      ]},
      name_conflict_test_types:struct_info(partial)
    )},
    {"ClassAndProp definition", ?_assertEqual(
      {struct, [{1, bool},{2, bool},{3, bool},{4, bool}]},
      name_conflict_test_types:struct_info('ClassAndProp')
    )},
    {"second_chance definition", ?_assertEqual(
      {struct, [{1, bool},{2, bool},{3, bool},{4, bool}]},
      name_conflict_test_types:struct_info(second_chance)
    )},
    {"NOW_EAT_THIS definition", ?_assertEqual(
      {struct, [{1, bool},{2, bool},{3, bool},{4, bool}]},
      name_conflict_test_types:struct_info('NOW_EAT_THIS')
    )},
    {"TheEdgeCase definition", ?_assertEqual(
      {struct, [{1, bool},{2, bool},{3, bool},{4, bool},{5, bool},{6, bool}]},
      name_conflict_test_types:struct_info('TheEdgeCase')
    )},
    {"Tricky_ definition", ?_assertEqual(
      {struct, [{1, bool},{2, bool}]},
      name_conflict_test_types:struct_info('Tricky_')
    )},
    {"Nested definition", ?_assertEqual(
      {struct, [
        {1, {struct, {name_conflict_test_types, 'ClassAndProp'}}},
        {2, {struct, {name_conflict_test_types, second_chance}}},
        {3, {struct, {name_conflict_test_types, 'NOW_EAT_THIS'}}},
        {4, {struct, {name_conflict_test_types, 'TheEdgeCase'}}},
        {5, {struct, {name_conflict_test_types, 'Tricky_'}}},
        {6, {struct, {name_conflict_test_types, 'Nested'}}}
      ]},
      name_conflict_test_types:struct_info('Nested')
    )},
    {"Problem_ definition", ?_assertEqual(
      {struct, [{1, bool},{2, bool}]},
      name_conflict_test_types:struct_info('Problem_')
    )},
    {"using extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, double, single, undefined},
        {2, undefined, double, integer, undefined}
      ]},
      name_conflict_test_types:struct_info_ext(using)
    )},
    {"delegate extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, string, partial, undefined},
        {2, undefined, {struct, {name_conflict_test_types, delegate}}, delegate, undefined}
      ]},
      name_conflict_test_types:struct_info_ext(delegate)
    )},
    {"get extended definition", ?_assertEqual(
      {struct, [{1, undefined, bool, sbyte, undefined}]},
      name_conflict_test_types:struct_info_ext(get)
    )},
    {"partial extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, {struct, {name_conflict_test_types, using}}, using, #using{}},
        {2, undefined, bool, read, undefined},
        {3, undefined, bool, write, undefined}
      ]},
      name_conflict_test_types:struct_info_ext(partial)
    )},
    {"ClassAndProp extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, bool, 'ClassAndProp', undefined},
        {2, undefined, bool, 'ClassAndProp_', undefined},
        {3, undefined, bool, 'ClassAndProp__', undefined},
        {4, undefined, bool, 'ClassAndProper', undefined}
      ]},
      name_conflict_test_types:struct_info_ext('ClassAndProp')
    )},
    {"second_chance extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, bool, 'SECOND_CHANCE', undefined},
        {2, undefined, bool, 'SECOND_CHANCE_', undefined},
        {3, undefined, bool, 'SECOND_CHANCE__', undefined},
        {4, undefined, bool, 'SECOND_CHANCES', undefined}
      ]},
      name_conflict_test_types:struct_info_ext(second_chance)
    )},
    {"NOW_EAT_THIS extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, bool, now_eat_this, undefined},
        {2, undefined, bool, now_eat_this_, undefined},
        {3, undefined, bool, now_eat_this__, undefined},
        {4, undefined, bool, now_eat_this_and_this, undefined}
      ]},
      name_conflict_test_types:struct_info_ext('NOW_EAT_THIS')
    )},
    {"TheEdgeCase extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, bool, theEdgeCase, undefined},
        {2, undefined, bool, theEdgeCase_, undefined},
        {3, undefined, bool, theEdgeCase__, undefined},
        {4, undefined, bool, 'TheEdgeCase', undefined},
        {5, undefined, bool, 'TheEdgeCase_', undefined},
        {6, undefined, bool, 'TheEdgeCase__', undefined}
      ]},
      name_conflict_test_types:struct_info_ext('TheEdgeCase')
    )},
    {"Tricky_ extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, bool, tricky, undefined},
        {2, undefined, bool, 'Tricky', undefined}
      ]},
      name_conflict_test_types:struct_info_ext('Tricky_')
    )},
    {"Nested extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, {struct, {
          name_conflict_test_types,
          'ClassAndProp'
        }}, 'ClassAndProp', #'ClassAndProp'{}},
        {2, undefined, {struct, {
          name_conflict_test_types,
          second_chance
        }}, second_chance, #second_chance{}},
        {3, undefined, {struct, {
          name_conflict_test_types,
          'NOW_EAT_THIS'
        }}, 'NOW_EAT_THIS', #'NOW_EAT_THIS'{}},
        {4, undefined, {struct, {
          name_conflict_test_types,
          'TheEdgeCase'
        }}, 'TheEdgeCase', #'TheEdgeCase'{}},
        {5, undefined, {struct, {
          name_conflict_test_types,
          'Tricky_'
        }}, 'Tricky_', #'Tricky_'{}},
        {6, undefined, {struct, {
          name_conflict_test_types,
          'Nested'
        }}, 'Nested', undefined}
      ]},
      name_conflict_test_types:struct_info_ext('Nested')
    )},
    {"Problem_ extended definition", ?_assertEqual(
      {struct, [
        {1, undefined, bool, problem, undefined},
        {2, undefined, bool, 'Problem', undefined}
      ]},
      name_conflict_test_types:struct_info_ext('Problem_')
    )}
  ].

service_info_test_() ->
  [
    {"event params", ?_assertEqual(
      {struct, [{1, {struct, {name_conflict_test_types, partial}}}]},
      extern_thrift:function_info(event, params_type)
    )},
    {"event reply", ?_assertEqual(
      {struct, {name_conflict_test_types, delegate}},
      extern_thrift:function_info(event, reply_type)
    )},
    {"event exceptions", ?_assertEqual(
      {struct, []},
      extern_thrift:function_info(event, exceptions)
    )},
    {"Foo params", ?_assertEqual(
      {struct, [{1, {struct, {name_conflict_test_types, 'Nested'}}}]},
      extern_thrift:function_info('Foo', params_type)
    )},
    {"Foo reply", ?_assertEqual(
      {struct, []},
      extern_thrift:function_info('Foo', reply_type)
    )},
    {"Foo exceptions", ?_assertEqual(
      {struct, [{1, {struct, {name_conflict_test_types, 'Problem_'}}}]},
      extern_thrift:function_info('Foo', exceptions)
    )}
  ].
