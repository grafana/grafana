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

% don't rename this thrift_test, it clobbers generated files
-module(thrift_test_test).
-compile(export_all).

-include_lib("eunit/include/eunit.hrl").

-include("gen-erl/thrift_test_constants.hrl").

constant_test_() ->
  [
    {"myNumberz equals 1", ?_assertEqual(1, ?THRIFT_TEST_MYNUMBERZ)}
  ].

record_generation_test_() ->
  [
    {"Bonk record", ?_assertMatch(
      {'thrift.test.Bonk', _, _},
      #'thrift.test.Bonk'{message=null,type=null}
    )},
    {"Bools record", ?_assertMatch(
      {'thrift.test.Bools', _, _},
      #'thrift.test.Bools'{im_true=null,im_false=null}
    )},
    {"Xtruct record", ?_assertMatch(
      {'thrift.test.Xtruct', _, _, _, _},
      #'thrift.test.Xtruct'{string_thing=null,byte_thing=null,i32_thing=null,i64_thing=null}
    )},
    {"Xtruct2 record", ?_assertMatch(
      {'thrift.test.Xtruct2', _, _, _},
      #'thrift.test.Xtruct2'{byte_thing=null,struct_thing=null,i32_thing=null}
    )},
    {"Xtruct3 record", ?_assertMatch(
      {'thrift.test.Xtruct3', _, _, _, _},
      #'thrift.test.Xtruct3'{string_thing=null,changed=null,i32_thing=null,i64_thing=null}
    )},
    {"Insanity record", ?_assertMatch(
      {'thrift.test.Insanity', _, _},
      #'thrift.test.Insanity'{userMap=null,xtructs=null}
    )},
    {"CrazyNesting record", ?_assertMatch(
      {'thrift.test.CrazyNesting', _, _, _, _},
      #'thrift.test.CrazyNesting'{
        string_field=null,
        set_field=null,
        list_field=null,
        binary_field=null
      }
    )},
    {"Xception record", ?_assertMatch(
      {'thrift.test.Xception', _, _},
      #'thrift.test.Xception'{errorCode=null,message=null}
    )},
    {"Xception2 record", ?_assertMatch(
      {'thrift.test.Xception2', _, _},
      #'thrift.test.Xception2'{errorCode=null,struct_thing=null}
    )},
    {"EmptyStruct record", ?_assertMatch({'thrift.test.EmptyStruct'}, #'thrift.test.EmptyStruct'{})},
    {"OneField record", ?_assertMatch({'thrift.test.OneField', _}, #'thrift.test.OneField'{field=null})},
    {"VersioningTestV1 record", ?_assertMatch(
      {'thrift.test.VersioningTestV1', _, _, _},
      #'thrift.test.VersioningTestV1'{begin_in_both=null,old_string=null,end_in_both=null}
    )},
    {"VersioningTestV2 record", ?_assertMatch(
      {'thrift.test.VersioningTestV2', _, _, _, _, _, _, _, _, _, _, _, _},
      #'thrift.test.VersioningTestV2'{
        begin_in_both=null,
        newint=null,
        newbyte=null,
        newshort=null,
        newlong=null,
        newdouble=null,
        newstruct=null,
        newlist=null,
        newset=null,
        newmap=null,
        newstring=null,
        end_in_both=null
      }
    )},
    {"ListTypeVersioningV1 record", ?_assertMatch(
      {'thrift.test.ListTypeVersioningV1', _, _},
      #'thrift.test.ListTypeVersioningV1'{myints=null,hello=null}
    )},
    {"ListTypeVersioningV2 record", ?_assertMatch(
      {'thrift.test.ListTypeVersioningV2', _, _},
      #'thrift.test.ListTypeVersioningV2'{strings=null,hello=null}
    )},
    {"GuessProtocolStruct record", ?_assertMatch(
      {'thrift.test.GuessProtocolStruct', _},
      #'thrift.test.GuessProtocolStruct'{map_field=null}
    )},
    {"LargeDeltas record", ?_assertMatch(
      {'thrift.test.LargeDeltas', _, _, _, _, _, _, _, _, _, _},
      #'thrift.test.LargeDeltas'{
        b1=null,
        b10=null,
        b100=null,
        check_true=null,
        b1000=null,
        check_false=null,
        vertwo2000=null,
        a_set2500=null,
        vertwo3000=null,
        big_numbers=null
      }
    )},
    {"NestedListsI32x2 record", ?_assertMatch(
      {'thrift.test.NestedListsI32x2', _},
      #'thrift.test.NestedListsI32x2'{integerlist=null}
    )},
    {"NestedListsI32x3 record", ?_assertMatch(
      {'thrift.test.NestedListsI32x3', _},
      #'thrift.test.NestedListsI32x3'{integerlist=null}
    )},
    {"NestedMixedx2 record", ?_assertMatch(
      {'thrift.test.NestedMixedx2', _, _, _},
      #'thrift.test.NestedMixedx2'{
        int_set_list=null,
        map_int_strset=null,
        map_int_strset_list=null
      }
    )},
    {"ListBonks record", ?_assertMatch({'thrift.test.ListBonks', _}, #'thrift.test.ListBonks'{bonk=null})},
    {"NestedListsBonk record", ?_assertMatch(
      {'thrift.test.NestedListsBonk', _},
      #'thrift.test.NestedListsBonk'{bonk=null}
    )},
    {"BoolTest record", ?_assertMatch(
      {'thrift.test.BoolTest', _, _},
      #'thrift.test.BoolTest'{b=null,s=null}
    )},
    {"StructA record", ?_assertMatch({'thrift.test.StructA', _}, #'thrift.test.StructA'{s=null})},
    {"StructB record", ?_assertMatch(
      {'thrift.test.StructB', _, _},
      #'thrift.test.StructB'{aa=null,ab=null}
    )}
  ].

struct_info_test_() ->
  [
    {"Bonk definition (short version)", ?_assertEqual(
      {struct, [{1, string}, {2, i32}]},
      thrift_test_types:struct_info('thrift.test.Bonk')
    )},
    {"Bonk definition", ?_assertEqual(
      {struct, [
        {1, undefined, string, message, undefined},
        {2, undefined, i32, type, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Bonk')
    )},
    {"Bools definition", ?_assertEqual(
      {struct, [
        {1, undefined, bool, im_true, undefined},
        {2, undefined, bool, im_false, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Bools')
    )},
    {"Xtruct definition", ?_assertEqual(
      {struct, [
        {1, undefined, string, string_thing, undefined},
        {4, undefined, byte, byte_thing, undefined},
        {9, undefined, i32, i32_thing, undefined},
        {11, undefined, i64, i64_thing, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Xtruct')
    )},
    {"Xtruct2 definition", ?_assertEqual(
      {struct, [
        {1, undefined, byte, byte_thing, undefined},
        {2, undefined, {struct, {'thrift_test_types', 'thrift.test.Xtruct'}}, struct_thing, #'thrift.test.Xtruct'{}},
        {3, undefined, i32, i32_thing, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Xtruct2')
    )},
    {"Xtruct3 definition", ?_assertEqual(
      {struct, [
        {1, undefined, string, string_thing, undefined},
        {4, undefined, i32, changed, undefined},
        {9, undefined, i32, i32_thing, undefined},
        {11, undefined, i64, i64_thing, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Xtruct3')
    )},
    {"Insanity definition", ?_assertEqual(
      {struct, [
        {1, undefined, {map, i32, i64}, userMap, dict:new()},
        {2, undefined, {list, {struct, {'thrift_test_types', 'thrift.test.Xtruct'}}}, xtructs, []}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Insanity')
    )},
    {"CrazyNesting definition", ?_assertEqual(
      {struct, [
        {1, undefined, string, string_field, undefined},
        {2, optional, {set, {struct, {'thrift_test_types', 'thrift.test.Insanity'}}}, set_field, sets:new()},
        {3, required, {list, {map,
          {set, i32},
          {map, i32, {set, {list, {map, {struct, {'thrift_test_types', 'thrift.test.Insanity'}}, string}}}}
        }}, list_field, []},
        {4, undefined, string, binary_field, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.CrazyNesting')
    )},
    {"Xception definition", ?_assertEqual(
      {struct, [
        {1, undefined, i32, errorCode, undefined},
        {2, undefined, string, message, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Xception')
    )},
    {"Xception2 definition", ?_assertEqual(
      {struct, [
        {1, undefined, i32, errorCode, undefined},
        {2, undefined, {struct, {'thrift_test_types', 'thrift.test.Xtruct'}}, struct_thing, #'thrift.test.Xtruct'{}}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.Xception2')
    )},
    {"EmptyStruct definition", ?_assertEqual(
      {struct, []},
      thrift_test_types:struct_info_ext('thrift.test.EmptyStruct')
    )},
    {"OneField definition", ?_assertEqual(
      {struct, [
        {1, undefined, {struct, {'thrift_test_types', 'thrift.test.EmptyStruct'}}, field, #'thrift.test.EmptyStruct'{}}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.OneField')
    )},
    {"VersioningTestV1 definition", ?_assertEqual(
      {struct, [
        {1, undefined, i32, begin_in_both, undefined},
        {3, undefined, string, old_string, undefined},
        {12, undefined, i32, end_in_both, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.VersioningTestV1')
    )},
    {"VersioningTestV2 definition", ?_assertEqual(
      {struct, [
        {1, undefined, i32, begin_in_both, undefined},
        {2, undefined, i32, newint, undefined},
        {3, undefined, byte, newbyte, undefined},
        {4, undefined, i16, newshort, undefined},
        {5, undefined, i64, newlong, undefined},
        {6, undefined, double, newdouble, undefined},
        {7, undefined, {struct, {thrift_test_types, 'thrift.test.Bonk'}}, newstruct, #'thrift.test.Bonk'{}},
        {8, undefined, {list, i32}, newlist, []},
        {9, undefined, {set, i32}, newset, sets:new()},
        {10, undefined, {map, i32, i32}, newmap, dict:new()},
        {11, undefined, string, newstring, undefined},
        {12, undefined, i32, end_in_both, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.VersioningTestV2')
    )},
    {"ListTypeVersioningV1 definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, i32}, myints, []},
        {2, undefined, string, hello, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.ListTypeVersioningV1')
    )},
    {"ListTypeVersioningV2 definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, string}, strings, []},
        {2, undefined, string, hello, undefined}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.ListTypeVersioningV2')
    )},
    {"GuessProtocolStruct definition", ?_assertEqual(
      {struct, [
        {7, undefined, {map, string, string}, map_field, dict:new()}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.GuessProtocolStruct')
    )},
    {"LargeDeltas definition", ?_assertEqual(
      {struct, [
        {1, undefined, {struct, {thrift_test_types, 'thrift.test.Bools'}}, b1, #'thrift.test.Bools'{}},
        {10, undefined, {struct, {thrift_test_types, 'thrift.test.Bools'}}, b10, #'thrift.test.Bools'{}},
        {100, undefined, {struct, {thrift_test_types, 'thrift.test.Bools'}}, b100, #'thrift.test.Bools'{}},
        {500, undefined, bool, check_true, undefined},
        {1000, undefined, {struct, {thrift_test_types, 'thrift.test.Bools'}}, b1000, #'thrift.test.Bools'{}},
        {1500, undefined, bool, check_false, undefined},
        {2000, undefined, {struct, {thrift_test_types, 'thrift.test.VersioningTestV2'}}, vertwo2000, #'thrift.test.VersioningTestV2'{}},
        {2500, undefined, {set, string}, a_set2500, sets:new()},
        {3000, undefined, {struct, {thrift_test_types, 'thrift.test.VersioningTestV2'}}, vertwo3000, #'thrift.test.VersioningTestV2'{}},
        {4000, undefined, {list, i32}, big_numbers, []}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.LargeDeltas')
    )},
    {"NestedListsI32x2 definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, {list, i32}}, integerlist, []}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.NestedListsI32x2')
    )},
    {"NestedListsI32x3 definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, {list, {list, i32}}}, integerlist, []}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.NestedListsI32x3')
    )},
    {"NestedMixedx2 definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, {set, i32}}, int_set_list, []},
        {2, undefined, {map, i32, {set, string}}, map_int_strset, dict:new()},
        {3, undefined, {list, {map, i32, {set, string}}}, map_int_strset_list, []}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.NestedMixedx2')
    )},
    {"ListBonks definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, {struct, {thrift_test_types, 'thrift.test.Bonk'}}}, bonk, []}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.ListBonks')
    )},
    {"NestedListsBonk definition", ?_assertEqual(
      {struct, [
        {1, undefined, {list, {list, {list, {struct, {thrift_test_types, 'thrift.test.Bonk'}}}}}, bonk, []}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.NestedListsBonk')
    )},
    {"BoolTest definition", ?_assertEqual(
      {struct, [
        {1, optional, bool, b, true},
        {2, optional, string, s, "true"}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.BoolTest')
    )},
    {"StructA definition", ?_assertEqual(
      {struct, [{1, required, string, s, undefined}]},
      thrift_test_types:struct_info_ext('thrift.test.StructA')
    )},
    {"StructB definition", ?_assertEqual(
      {struct, [
        {1, optional, {struct, {thrift_test_types, 'thrift.test.StructA'}}, aa, #'thrift.test.StructA'{}},
        {2, required, {struct, {thrift_test_types, 'thrift.test.StructA'}}, ab, #'thrift.test.StructA'{}}
      ]},
      thrift_test_types:struct_info_ext('thrift.test.StructB')
    )}
  ].

service_info_test_() ->
  [
    {"testVoid params", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testVoid, params_type)
    )},
    {"testVoid reply", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testVoid, reply_type)
    )},
    {"testVoid exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testVoid, exceptions)
    )},
    {"testString params", ?_assertEqual(
      {struct, [{1, string}]},
      thrift_test_thrift:function_info(testString, params_type)
    )},
    {"testString reply", ?_assertEqual(
      string,
      thrift_test_thrift:function_info(testString, reply_type)
    )},
    {"testString exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testString, exceptions)
    )},
    {"testByte params", ?_assertEqual(
      {struct, [{1, byte}]},
      thrift_test_thrift:function_info(testByte, params_type)
    )},
    {"testByte reply", ?_assertEqual(
      byte,
      thrift_test_thrift:function_info(testByte, reply_type)
    )},
    {"testByte exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testByte, exceptions)
    )},
    {"testI32 params", ?_assertEqual(
      {struct, [{1, i32}]},
      thrift_test_thrift:function_info(testI32, params_type)
    )},
    {"testI32 reply", ?_assertEqual(
      i32,
      thrift_test_thrift:function_info(testI32, reply_type)
    )},
    {"testI32 exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testI32, exceptions)
    )},
    {"testI64 params", ?_assertEqual(
      {struct, [{1, i64}]},
      thrift_test_thrift:function_info(testI64, params_type)
    )},
    {"testI64 reply", ?_assertEqual(
      i64,
      thrift_test_thrift:function_info(testI64, reply_type)
    )},
    {"testI64 exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testI64, exceptions)
    )},
    {"testDouble params", ?_assertEqual(
      {struct, [{1, double}]},
      thrift_test_thrift:function_info(testDouble, params_type)
    )},
    {"testDouble reply", ?_assertEqual(
      double,
      thrift_test_thrift:function_info(testDouble, reply_type)
    )},
    {"testDouble exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testDouble, exceptions)
    )},
    {"testStruct params", ?_assertEqual(
      {struct, [
        {1, {struct, {thrift_test_types, 'thrift.test.Xtruct'}}}
      ]},
      thrift_test_thrift:function_info(testStruct, params_type)
    )},
    {"testStruct reply", ?_assertEqual(
      {struct, {thrift_test_types, 'thrift.test.Xtruct'}},
      thrift_test_thrift:function_info(testStruct, reply_type)
    )},
    {"testStruct exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testStruct, exceptions)
    )},
    {"testNest params", ?_assertEqual(
      {struct, [
        {1, {struct, {thrift_test_types, 'thrift.test.Xtruct2'}}}
      ]},
      thrift_test_thrift:function_info(testNest, params_type)
    )},
    {"testNest reply", ?_assertEqual(
      {struct, {thrift_test_types, 'thrift.test.Xtruct2'}},
      thrift_test_thrift:function_info(testNest, reply_type)
    )},
    {"testNest exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testNest, exceptions)
    )},
    {"testMap params", ?_assertEqual(
      {struct, [
        {1, {map, i32, i32}}
      ]},
      thrift_test_thrift:function_info(testMap, params_type)
    )},
    {"testMap reply", ?_assertEqual(
      {map, i32, i32},
      thrift_test_thrift:function_info(testMap, reply_type)
    )},
    {"testMap exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testMap, exceptions)
    )},
    {"testStringMap params", ?_assertEqual(
      {struct, [
        {1, {map, string, string}}
      ]},
      thrift_test_thrift:function_info(testStringMap, params_type)
    )},
    {"testStringMap reply", ?_assertEqual(
      {map, string, string},
      thrift_test_thrift:function_info(testStringMap, reply_type)
    )},
    {"testStringMap exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testStringMap, exceptions)
    )},
    {"testSet params", ?_assertEqual(
      {struct, [
        {1, {set, i32}}
      ]},
      thrift_test_thrift:function_info(testSet, params_type)
    )},
    {"testSet reply", ?_assertEqual(
      {set, i32},
      thrift_test_thrift:function_info(testSet, reply_type)
    )},
    {"testSet exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testSet, exceptions)
    )},
    {"testList params", ?_assertEqual(
      {struct, [
        {1, {list, i32}}
      ]},
      thrift_test_thrift:function_info(testList, params_type)
    )},
    {"testList reply", ?_assertEqual(
      {list, i32},
      thrift_test_thrift:function_info(testList, reply_type)
    )},
    {"testList exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testList, exceptions)
    )},
    {"testEnum params", ?_assertEqual(
      {struct, [
        {1, i32}
      ]},
      thrift_test_thrift:function_info(testEnum, params_type)
    )},
    {"testEnum reply", ?_assertEqual(
      i32,
      thrift_test_thrift:function_info(testEnum, reply_type)
    )},
    {"testEnum exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testEnum, exceptions)
    )},
    {"testTypedef params", ?_assertEqual(
      {struct, [{1, i64}]},
      thrift_test_thrift:function_info(testTypedef, params_type)
    )},
    {"testTypedef reply", ?_assertEqual(
      i64,
      thrift_test_thrift:function_info(testTypedef, reply_type)
    )},
    {"testTypedef exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testTypedef, exceptions)
    )},
    {"testMapMap params", ?_assertEqual(
      {struct, [
        {1, i32}
      ]},
      thrift_test_thrift:function_info(testMapMap, params_type)
    )},
    {"testMapMap reply", ?_assertEqual(
      {map, i32, {map, i32,i32}},
      thrift_test_thrift:function_info(testMapMap, reply_type)
    )},
    {"testMapMap exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testMapMap, exceptions)
    )},
    {"testInsanity params", ?_assertEqual(
      {struct, [
        {1, {struct, {thrift_test_types, 'thrift.test.Insanity'}}}
      ]},
      thrift_test_thrift:function_info(testInsanity, params_type)
    )},
    {"testInsanity reply", ?_assertEqual(
      {map, i64, {map, i32, {struct, {'thrift_test_types', 'thrift.test.Insanity'}}}},
      thrift_test_thrift:function_info(testInsanity, reply_type)
    )},
    {"testInsanity exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testInsanity, exceptions)
    )},
    {"testMulti params", ?_assertEqual(
      {struct, [
        {1, byte},
        {2, i32},
        {3, i64},
        {4, {map, i16, string}},
        {5, i32},
        {6, i64}
      ]},
      thrift_test_thrift:function_info(testMulti, params_type)
    )},
    {"testMulti reply", ?_assertEqual(
      {struct, {thrift_test_types, 'thrift.test.Xtruct'}},
      thrift_test_thrift:function_info(testMulti, reply_type)
    )},
    {"testMulti exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testMulti, exceptions)
    )},
    {"testException params", ?_assertEqual(
      {struct, [{1, string}]},
      thrift_test_thrift:function_info(testException, params_type)
    )},
    {"testException reply", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testException, reply_type)
    )},
    {"testException exceptions", ?_assertEqual(
      {struct, [
        {1, {struct, {thrift_test_types, 'thrift.test.Xception'}}}
      ]},
      thrift_test_thrift:function_info(testException, exceptions)
    )},
    {"testMultiException params", ?_assertEqual(
      {struct, [{1, string}, {2, string}]},
      thrift_test_thrift:function_info(testMultiException, params_type)
    )},
    {"testMultiException reply", ?_assertEqual(
      {struct, {thrift_test_types, 'thrift.test.Xtruct'}},
      thrift_test_thrift:function_info(testMultiException, reply_type)
    )},
    {"testMultiException exceptions", ?_assertEqual(
      {struct, [
        {1, {struct, {thrift_test_types, 'thrift.test.Xception'}}},
        {2, {struct, {thrift_test_types, 'thrift.test.Xception2'}}}
      ]},
      thrift_test_thrift:function_info(testMultiException, exceptions)
    )},
    {"testOneway params", ?_assertEqual(
      {struct, [{1, i32}]},
      thrift_test_thrift:function_info(testOneway, params_type)
    )},
    {"testOneway reply", ?_assertEqual(
      oneway_void,
      thrift_test_thrift:function_info(testOneway, reply_type)
    )},
    {"testOneway exceptions", ?_assertEqual(
      {struct, []},
      thrift_test_thrift:function_info(testOneway, exceptions)
    )},
    {"blahBlah params", ?_assertEqual(
      {struct, []},
      second_service_thrift:function_info(blahBlah, params_type)
    )},
    {"blahBlah reply", ?_assertEqual(
      {struct, []},
      second_service_thrift:function_info(blahBlah, reply_type)
    )},
    {"blahBlah exceptions", ?_assertEqual(
      {struct, []},
      second_service_thrift:function_info(blahBlah, exceptions)
    )},
    {"secondtestString params", ?_assertEqual(
      {struct, [{1, string}]},
      second_service_thrift:function_info(secondtestString, params_type)
    )},
    {"secondtestString reply", ?_assertEqual(
      string,
      second_service_thrift:function_info(secondtestString, reply_type)
    )},
    {"secondtestString exceptions", ?_assertEqual(
      {struct, []},
      second_service_thrift:function_info(secondtestString, exceptions)
    )}
  ].
