/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include "thrift/parse/t_program.h"
#include "thrift/plugin/type_util.h"
#include "thrift/plugin/plugin_types.h"

#include <map>
#include <vector>

#include <boost/preprocessor.hpp>
#include <boost/test/included/unit_test.hpp>
#include <boost/test/parameterized_test.hpp>

using namespace apache::thrift;
using namespace boost::unit_test;

namespace test_data {
#define T_TEST_TYPES                                                                               \
  BOOST_PP_TUPLE_TO_LIST(14,                                                                       \
                         (program,                                                                 \
                          base_type,                                                               \
                          enum_value,                                                              \
                          enum,                                                                    \
                          const_value,                                                             \
                          const,                                                                   \
                          list,                                                                    \
                          set,                                                                     \
                          map,                                                                     \
                          field,                                                                   \
                          struct,                                                                  \
                          typedef,                                                                 \
                          function,                                                                \
                          service))
#define T_DELETE_TESTDATA(r, d, elem)                                                              \
  for (std::vector<t_##elem*>::reverse_iterator it = elem##s.rbegin(); it != elem##s.rend(); it++) \
    delete *it;
#define T_DECL_TESTDATA(r, d, elem) static std::vector< ::t_##elem*> elem##s;
BOOST_PP_LIST_FOR_EACH(T_DECL_TESTDATA, _, T_TEST_TYPES)
#undef T_DECL_TESTDATA

bool has_data = false;
void cleanup() {
  if (has_data) {
    has_data = false;
    BOOST_PP_LIST_FOR_EACH(T_DELETE_TESTDATA, _, T_TEST_TYPES)
  }
}

void init_programs() {
  programs.push_back(new t_program("prog path", "prog_name"));
}

void init_base_types() {
  base_types.push_back(new ::t_base_type("name0", ::t_base_type::TYPE_VOID));
  base_types.push_back(new ::t_base_type("name1", ::t_base_type::TYPE_STRING));
  base_types.push_back(new ::t_base_type("name2", ::t_base_type::TYPE_BOOL));
  base_types.push_back(new ::t_base_type("name3", ::t_base_type::TYPE_I8));
  base_types.push_back(new ::t_base_type("name4", ::t_base_type::TYPE_I16));
  base_types.push_back(new ::t_base_type("name5", ::t_base_type::TYPE_I32));
  base_types.push_back(new ::t_base_type("name6", ::t_base_type::TYPE_I64));
  base_types.push_back(new ::t_base_type("name7", ::t_base_type::TYPE_DOUBLE));
}

void init_const_values() {
  const_values.push_back(new t_const_value(42));
  const_values.push_back(new t_const_value("foo"));
  {
    t_const_value* x = new t_const_value;
    x->set_double(3.1415);
    const_values.push_back(x);
  }
  {
    t_const_value* x = new t_const_value;
    x->set_identifier("bar");
    x->set_enum(enums[0]);
    const_values.push_back(x);
  }
  {
    t_const_value* x = new t_const_value;
    x->set_map();
    x->add_map(const_values[0], const_values[1]);
    x->add_map(const_values[1], const_values[0]);
    const_values.push_back(x);
  }
  {
    t_const_value* x = new t_const_value;
    x->set_list();
    x->add_list(const_values[0]);
    x->add_list(const_values[1]);
    const_values.push_back(x);
  }
}

void init_consts() {
  // base_type/enum indexes for this and other tests are arbitrary
  consts.push_back(new t_const(base_types[2], "aaa", const_values[0]));
  consts.back()->set_doc("soem doc");
  consts.push_back(new t_const(base_types[3], "bbb", const_values[1]));
}

void init_enum_values() {
  enum_values.push_back(new t_enum_value("VAL1", 11));
  enum_values.back()->set_doc("enum doc 1");
  enum_values.back()->annotations_.insert(std::make_pair("anno1", "val1"));

  enum_values.push_back(new t_enum_value("VAL2", 22));
}

void init_enums() {
  enums.push_back(new t_enum(programs[0]));
  enums.back()->set_doc("enum doc 1");
  enums.back()->annotations_.insert(std::make_pair("anno1", "val1"));
  enums.back()->set_name("fooo");
  enums.back()->append(enum_values[0]);
  enums.back()->append(enum_values[1]);
}

void init_lists() {
  lists.push_back(new t_list(enums[0]));
  lists.push_back(new t_list(base_types[5]));
  lists.back()->set_cpp_name("list_cpp_name_1");
}
void init_sets() {
  sets.push_back(new t_set(base_types[4]));
  sets.push_back(new t_set(enums[0]));
  sets.back()->set_cpp_name("set_cpp_name_1");
}
void init_maps() {
  maps.push_back(new t_map(base_types[4], base_types[1]));
  maps.push_back(new t_map(base_types[5], enums[0]));
  maps.back()->set_cpp_name("map_cpp_name_1");
}

void init_typedefs() {
  typedefs.push_back(new t_typedef(programs[0], base_types[3], "VAL1"));
}
void init_fields() {
  fields.push_back(new t_field(base_types[1], "f1"));
  fields.back()->set_reference(false);
  fields.back()->set_req(t_field::T_OPTIONAL);
  fields.push_back(new t_field(base_types[2], "f2", 9));
  fields.back()->set_reference(true);
  fields.push_back(new t_field(base_types[3], "f3", 11));
  fields.back()->set_req(t_field::T_REQUIRED);
  fields.back()->set_value(const_values[0]);
}
void init_structs() {
  structs.push_back(new t_struct(programs[0], "struct1"));
  structs.back()->append(fields[0]);
  structs.back()->append(fields[1]);
  structs.push_back(new t_struct(programs[0], "union1"));
  structs.back()->append(fields[0]);
  structs.back()->append(fields[1]);
  structs.back()->set_union(true);
  structs.push_back(new t_struct(programs[0], "xcept1"));
  structs.back()->set_xception(true);
}
void init_functions() {
  structs.push_back(new t_struct(programs[0], "errs1"));
  t_struct* errors = structs.back();
  structs.push_back(new t_struct(programs[0], "args1"));
  t_struct* arglist = structs.back();
  functions.push_back(new t_function(base_types[0], "func1", errors, arglist, false));
  functions.push_back(new t_function(base_types[0], "func2", errors, arglist, true));
}
void init_services() {
  services.push_back(new t_service(programs[0]));
  services.back()->set_doc("srv1 doc");
  services.back()->set_name("srv1");
  services.back()->add_function(functions[0]);
  services.back()->add_function(functions[1]);

  services.push_back(new t_service(programs[0]));
  services.back()->set_name("srv2");
  services.back()->set_extends(services[0]);
}

std::vector<t_type*> types;
void init_types() {
#define T_COPY_TYPES(type) std::copy(type##s.begin(), type##s.end(), std::back_inserter(types))
  T_COPY_TYPES(base_type);
  T_COPY_TYPES(enum);
  T_COPY_TYPES(typedef);
  T_COPY_TYPES(struct);
  T_COPY_TYPES(list);
  T_COPY_TYPES(set);
  T_COPY_TYPES(map);
// T_COPY_TYPES(service);
#undef T_COPY_TYPES
}

void init() {
  if (!has_data) {
    has_data = true;
#define T_INIT_TESTDATA(r, d, elem) init_##elem##s();
    BOOST_PP_LIST_FOR_EACH(T_INIT_TESTDATA, _, T_TEST_TYPES)
    init_types();
#undef T_INIT_TESTDATA
  }
}
}
struct GlobalFixture {
  ~GlobalFixture() { test_data::cleanup(); }
};
#if (BOOST_VERSION >= 105900)
BOOST_GLOBAL_FIXTURE(GlobalFixture);
#else
BOOST_GLOBAL_FIXTURE(GlobalFixture)
#endif

void migrate_global_cache() {
  plugin::TypeRegistry reg;
  plugin_output::get_global_cache(reg);
  plugin::set_global_cache(reg);
  plugin_output::clear_global_cache();
}
template <typename T>
T* round_trip(T* t) {
  typename plugin::ToType<T>::type p;
  plugin_output::convert(t, p);
  migrate_global_cache();
  return plugin::convert(p);
}

void test_base_type(::t_base_type* sut) {
  plugin::t_base_type p;
  plugin_output::convert(sut, p);
  boost::scoped_ptr< ::t_base_type> sut2(plugin::convert(p));

#define THRIFT_CHECK(r, data, elem) BOOST_PP_EXPAND(BOOST_CHECK_EQUAL(data elem, sut2->elem));
  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(7,
                                                (is_void(),
                                                 is_string(),
                                                 is_bool(),
                                                 is_string_list(),
                                                 is_binary(),
                                                 is_string_enum(),
                                                 is_base_type())))
}

void test_const_value(t_const_value* sut) {
  boost::scoped_ptr<t_const_value> sut2(round_trip(sut));

  BOOST_CHECK_EQUAL(sut->get_type(), sut2->get_type());
  switch (sut->get_type()) {
#define T_CONST_VALUE_CASE(type, name)                                                             \
  case t_const_value::type:                                                                        \
    BOOST_CHECK_EQUAL(sut->get_##name(), sut2->get_##name());                                      \
    break
    T_CONST_VALUE_CASE(CV_INTEGER, integer);
    T_CONST_VALUE_CASE(CV_DOUBLE, double);
    T_CONST_VALUE_CASE(CV_STRING, string);
    T_CONST_VALUE_CASE(CV_IDENTIFIER, identifier);
#undef T_CONST_VALUE_CASE
  case t_const_value::CV_MAP:
    BOOST_CHECK_EQUAL(sut->get_map().size(), sut2->get_map().size());
    {
      std::map<t_const_value::t_const_value_type, t_const_value::t_const_value_type> sut_values;
      for (std::map<t_const_value*, t_const_value*>::const_iterator it = sut->get_map().begin();
           it != sut->get_map().end(); it++) {
        sut_values[it->first->get_type()] = it->second->get_type();
      }
      std::map<t_const_value::t_const_value_type, t_const_value::t_const_value_type> sut2_values;
      for (std::map<t_const_value*, t_const_value*>::const_iterator it = sut2->get_map().begin();
           it != sut2->get_map().end(); it++) {
        sut2_values[it->first->get_type()] = it->second->get_type();
      }
      BOOST_CHECK_EQUAL(sut_values.begin()->first, sut2_values.begin()->first);
      BOOST_CHECK_EQUAL(sut_values.begin()->second, sut2_values.begin()->second);
    }
    break;
  case t_const_value::CV_LIST:
    BOOST_CHECK_EQUAL(sut->get_list().size(), sut2->get_list().size());
    BOOST_CHECK_EQUAL(sut->get_list().front()->get_type(), sut2->get_list().front()->get_type());
    break;
  default:
    BOOST_ASSERT(false);
    break;
  }
}

void test_const(t_const* sut) {
  boost::scoped_ptr< ::t_const> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(4,
                                                (get_type()->get_name(),
                                                 get_name(),
                                                 get_value()->get_type(),
                                                 get_doc())))
}

void test_enum_value(t_enum_value* sut) {
  boost::scoped_ptr<t_enum_value> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(3, (get_name(), get_value(), get_doc())))
}

void test_enum(t_enum* sut) {
  boost::scoped_ptr< ::t_enum> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(6,
                                                (get_name(),
                                                 get_min_value()->get_value(),
                                                 get_max_value()->get_value(),
                                                 get_constant_by_value(11)->get_value(),
                                                 get_constant_by_name("VAL1")->get_value(),
                                                 get_doc())))
}

void test_list(t_list* sut) {
  boost::scoped_ptr<t_list> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(4,
                                                (get_elem_type()->get_name(),
                                                 has_cpp_name(),
                                                 get_doc(),
                                                 get_name())))
  if (sut->has_cpp_name())
    BOOST_CHECK_EQUAL(sut->get_cpp_name(), sut2->get_cpp_name());
}
void test_set(t_set* sut) {
  boost::scoped_ptr<t_set> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(4,
                                                (get_elem_type()->get_name(),
                                                 has_cpp_name(),
                                                 get_doc(),
                                                 get_name())))
  if (sut->has_cpp_name())
    BOOST_CHECK_EQUAL(sut->get_cpp_name(), sut2->get_cpp_name());
}
void test_map(t_map* sut) {
  boost::scoped_ptr<t_map> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(5,
                                                (get_key_type()->get_name(),
                                                 get_val_type()->get_name(),
                                                 has_cpp_name(),
                                                 get_doc(),
                                                 get_name())))
  if (sut->has_cpp_name())
    BOOST_CHECK_EQUAL(sut->get_cpp_name(), sut2->get_cpp_name());
}

void test_typedef(t_typedef* sut) {
  boost::scoped_ptr<t_typedef> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(4,
                                                (get_doc(),
                                                 get_name(),
                                                 get_symbolic(),
                                                 is_forward_typedef())))
}

void test_type(t_type* sut) {
  boost::scoped_ptr<t_type> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(15,
                                                (is_void(),
                                                 is_base_type(),
                                                 is_string(),
                                                 is_bool(),
                                                 is_typedef(),
                                                 is_enum(),
                                                 is_struct(),
                                                 is_xception(),
                                                 is_container(),
                                                 is_list(),
                                                 is_set(),
                                                 is_map(),
                                                 is_service(),
                                                 get_doc(),
                                                 get_name())))
}

void test_field(t_field* sut) {
  boost::scoped_ptr<t_field> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(5,
                                                (get_req(),
                                                 get_reference(),
                                                 get_key(),
                                                 get_doc(),
                                                 get_name())))
  if (sut->get_value()) {
    THRIFT_CHECK(, sut->, get_value()->get_type());
  } else {
    BOOST_CHECK(!sut2->get_value());
  }
  if (sut->get_type()) {
    THRIFT_CHECK(, sut->, get_type()->get_name());
  } else {
    BOOST_CHECK(!sut2->get_type());
  }
}
void test_struct(t_struct* sut) {
  boost::scoped_ptr<t_struct> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(5,
                                                (is_union(),
                                                 is_xception(),
                                                 is_struct(),
                                                 get_doc(),
                                                 get_name())))
}

void test_function(t_function* sut) {
  boost::scoped_ptr<t_function> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(
      THRIFT_CHECK,
      sut->,
      BOOST_PP_TUPLE_TO_LIST(4, (get_doc(), get_name(), get_returntype()->get_name(), is_oneway())))
}
void test_service(t_service* sut) {
  boost::scoped_ptr<t_service> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK,
                         sut->,
                         BOOST_PP_TUPLE_TO_LIST(3, (get_doc(), get_name(), get_functions().size())))
  if (sut->get_extends()) {
    THRIFT_CHECK(, sut->, get_extends()->get_name());
  } else {
    BOOST_CHECK(!sut2->get_extends());
  }
}

void test_program(t_program* sut) {
  boost::scoped_ptr<t_program> sut2(round_trip(sut));

  BOOST_PP_LIST_FOR_EACH(THRIFT_CHECK, sut->, BOOST_PP_TUPLE_TO_LIST(2, (get_doc(), get_name())))
}
boost::unit_test::test_suite* do_init_unit_test_suite() {
  test_data::init();
  test_suite* ts = BOOST_TEST_SUITE("PluginConversionTest");

#define T_TEST_CASE(r, d, type)                                                                    \
  ts->add(BOOST_PARAM_TEST_CASE(test_##type, test_data::type##s.begin(), test_data::type##s.end()));
  BOOST_PP_LIST_FOR_EACH(T_TEST_CASE, _, T_TEST_TYPES)
  T_TEST_CASE(_, _, type)
#undef T_TEST_CASE
  return ts;
}

#ifdef BOOST_TEST_DYN_LINK
bool init_unit_test_suite() {
  framework::master_test_suite().add(do_init_unit_test_suite());
  return true;
}
int main(int argc, char* argv[]) {
  return ::boost::unit_test::unit_test_main(&init_unit_test_suite, argc, argv);
}
#else
boost::unit_test::test_suite* init_unit_test_suite(int argc, char* argv[]) {
  return do_init_unit_test_suite();
}
#endif
