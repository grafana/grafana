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

#include "thrift/plugin/plugin.h"

#ifdef _WIN32
#include <fcntl.h>
#include <io.h>
#endif

#include <cassert>
#include <iostream>

#include <boost/bind.hpp>
#include <boost/range/adaptor/map.hpp>
#include <boost/range/algorithm/for_each.hpp>
#include <boost/smart_ptr.hpp>

#include "thrift/generate/t_generator.h"
#include "thrift/plugin/type_util.h"
#include "thrift/protocol/TBinaryProtocol.h"
#include "thrift/transport/TBufferTransports.h"
#include "thrift/transport/TFDTransport.h"

#include "thrift/plugin/plugin_types.h"

namespace apache {
namespace thrift {
namespace plugin {

using apache::thrift::protocol::TBinaryProtocol;
using apache::thrift::transport::TFDTransport;
using apache::thrift::transport::TFramedTransport;

#define THRIFT_CONVERT_FORWARD(from_type)                                                          \
  template <>                                                                                      \
  typename ToType<from_type>::type* convert_forward<from_type>(const from_type& from)

#define THRIFT_CONVERT_COMPLETE_DECL(from_type)                                                    \
  template <>                                                                                      \
  void convert(const from_type& from, ToType<from_type>::type* to)

#define THRIFT_CONVERT_UNARY_DECL(from_type)                                                       \
  template <>                                                                                      \
  typename ToType<from_type>::type* convert<from_type>(const from_type& from)

#define THRIFT_CONVERSION_DECL(from_type)                                                          \
  THRIFT_CONVERT_FORWARD(from_type);                                                               \
  THRIFT_CONVERT_COMPLETE_DECL(from_type);                                                         \
  THRIFT_CONVERT_UNARY_DECL(from_type)

#define THRIFT_CONVERT_COMPLETE(from_type)                                                         \
  THRIFT_CONVERSION_DECL(from_type) {                                                              \
    ToType<from_type>::type* to = convert_forward(from);                                           \
    convert(from, to);                                                                             \
    return to;                                                                                     \
  }                                                                                                \
  THRIFT_CONVERT_COMPLETE_DECL(from_type)

#define THRIFT_CONVERSION(from_type, ...)                                                          \
  THRIFT_CONVERT_FORWARD(from_type) {                                                              \
    (void)from;                                                                                    \
    return new ToType<from_type>::type(__VA_ARGS__);                                               \
  }                                                                                                \
  THRIFT_CONVERT_COMPLETE(from_type)

#define THRIFT_ASSIGN_DOC()                                                                        \
  do {                                                                                             \
    if (from.__isset.doc)                                                                          \
      to->set_doc(from.doc);                                                                       \
  } while (0)

#define THRIFT_ASSIGN_ANNOTATIONS()                                                                \
  THRIFT_ASSIGN_DOC();                                                                             \
  do {                                                                                             \
    if (from.__isset.annotations)                                                                  \
      to->annotations_ = from.annotations;                                                         \
  } while (0)

#define THRIFT_ASSIGN_METADATA()                                                                   \
  do {                                                                                             \
    to->set_name(from.metadata.name);                                                              \
    if (from.metadata.__isset.doc)                                                                 \
      to->set_doc(from.metadata.doc);                                                              \
    if (from.metadata.__isset.annotations)                                                         \
      to->annotations_ = from.metadata.annotations;                                                \
  } while (0)

::t_program* g_program = 0;

template <typename C, typename S>
struct TypeCache {
  C* operator[](const int64_t& k) {
    typename std::map<int64_t, C*>::iterator it = cache.find(k);
    if (it != cache.end()) {
      return it->second;
    } else {
      typename std::map<int64_t, S>::const_iterator cit = source->find(k);
      if (cit == source->end()) {
        throw ThriftPluginError("Type not found");
      }
      return (cache)[k] = convert_forward(cit->second);
    }
  }

  void compileAll() {
    boost::for_each(*source | boost::adaptors::map_keys,
                    boost::bind(&TypeCache::compile, this, _1));
  }

  std::map<int64_t, S> const* source;

protected:
  std::map<int64_t, C*> cache;

private:
  void compile(const int64_t& k) {
    typename std::map<int64_t, S>::const_iterator cit = source->find(k);
    if (cit == source->end()) {
      throw ThriftPluginError("Type not found ");
    }
    convert(cit->second, (*this)[k]);
  }
};
std::map<int64_t, ::t_program*> g_program_cache;
TypeCache< ::t_type, t_type> g_type_cache;
TypeCache< ::t_const, t_const> g_const_cache;
TypeCache< ::t_service, t_service> g_service_cache;

void set_global_cache(const TypeRegistry& from) {
  g_type_cache.source = &from.types;
  g_const_cache.source = &from.constants;
  g_service_cache.source = &from.services;

  g_type_cache.compileAll();
  g_const_cache.compileAll();
  g_service_cache.compileAll();
}

template <typename T>
T* resolve_type(int64_t name) {
  return reinterpret_cast<T*>(g_type_cache[name]);
}

::t_const* resolve_const(int64_t name) {
  return g_const_cache[name];
}

::t_service* resolve_service(int64_t name) {
  return g_service_cache[name];
}

THRIFT_CONVERT_FORWARD(t_base_type) {
#define T_BASETYPE_CASE(type)                                                                      \
  case t_base::TYPE_##type:                                                                        \
    t = ::t_base_type::TYPE_##type;                                                                \
    break

  ::t_base_type::t_base t = ::t_base_type::TYPE_VOID;
  bool is_binary = false;
  switch (from.value) {
    T_BASETYPE_CASE(VOID);
    T_BASETYPE_CASE(STRING);
    T_BASETYPE_CASE(BOOL);
    T_BASETYPE_CASE(I8);
    T_BASETYPE_CASE(I16);
    T_BASETYPE_CASE(I32);
    T_BASETYPE_CASE(I64);
    T_BASETYPE_CASE(DOUBLE);
  case t_base::TYPE_BINARY:
    t = ::t_base_type::TYPE_STRING;
    is_binary = true;
    break;
  }
  ::t_base_type* to = new ::t_base_type(from.metadata.name, t);
  to->set_binary(is_binary);
  return to;
#undef T_BASETYPE_CASE
}
THRIFT_CONVERT_COMPLETE(t_base_type) {
  THRIFT_ASSIGN_METADATA();
}

THRIFT_CONVERT_FORWARD(t_typedef) {
  ::t_typedef* to;
  if (from.forward) {
    to = new ::t_typedef(g_program_cache[from.metadata.program_id], from.symbolic, true);
  } else {
    to = new ::t_typedef(g_program_cache[from.metadata.program_id],
                         resolve_type< ::t_type>(from.type), from.symbolic);
  }
  return to;
}
THRIFT_CONVERT_COMPLETE(t_typedef) {
  THRIFT_ASSIGN_METADATA();
}
THRIFT_CONVERSION(t_enum_value, from.name, from.value) {
  assert(to);
  THRIFT_ASSIGN_ANNOTATIONS();
}
THRIFT_CONVERSION(t_enum, g_program_cache[from.metadata.program_id]) {
  assert(to);
  THRIFT_ASSIGN_METADATA();
  boost::for_each(from.constants | boost::adaptors::transformed(convert<t_enum_value>),
                  boost::bind(&::t_enum::append, to, _1));
}
THRIFT_CONVERSION(t_list, resolve_type< ::t_type>(from.elem_type)) {
  assert(to);
  THRIFT_ASSIGN_METADATA();
  if (from.__isset.cpp_name)
    to->set_cpp_name(from.cpp_name);
}
THRIFT_CONVERSION(t_set, resolve_type< ::t_type>(from.elem_type)) {
  assert(to);
  THRIFT_ASSIGN_METADATA();
  if (from.__isset.cpp_name)
    to->set_cpp_name(from.cpp_name);
}
THRIFT_CONVERSION(t_map,
                  resolve_type< ::t_type>(from.key_type),
                  resolve_type< ::t_type>(from.val_type)) {
  assert(to);
  THRIFT_ASSIGN_METADATA();
  if (from.__isset.cpp_name)
    to->set_cpp_name(from.cpp_name);
}
THRIFT_CONVERSION(t_const_value, ) {
#define T_CONST_VALUE_CASE(type)                                                                   \
  if (from.__isset.type##_val)                                                                     \
  to->set_##type(from.type##_val)

  assert(to);
  if (from.__isset.map_val) {
    to->set_map();
    for (std::map<t_const_value, t_const_value>::const_iterator it = from.map_val.begin();
         it != from.map_val.end(); it++) {
      to->add_map(convert(it->first), convert(it->second));
    }
  } else if (from.__isset.list_val) {
    to->set_list();
    boost::for_each(from.list_val | boost::adaptors::transformed(&convert<t_const_value>),
                    boost::bind(&::t_const_value::add_list, to, _1));
  } else
    T_CONST_VALUE_CASE(string);
  else T_CONST_VALUE_CASE(integer);
  else T_CONST_VALUE_CASE(double);
  else {
    T_CONST_VALUE_CASE(identifier);
    if (from.__isset.enum_val)
      to->set_enum(resolve_type< ::t_enum>(from.enum_val));
  }
#undef T_CONST_VALUE_CASE
}
THRIFT_CONVERSION(t_field, resolve_type< ::t_type>(from.type), from.name, from.key) {
  assert(to);
  THRIFT_ASSIGN_ANNOTATIONS();
  to->set_reference(from.reference);
  to->set_req(static_cast< ::t_field::e_req>(from.req));
  if (from.__isset.value) {
    to->set_value(convert(from.value));
  }
}
THRIFT_CONVERSION(t_struct, g_program_cache[from.metadata.program_id]) {
  assert(to);
  THRIFT_ASSIGN_METADATA();
  to->set_union(from.is_union);
  to->set_xception(from.is_xception);
  boost::for_each(from.members | boost::adaptors::transformed(convert<t_field>),
                  boost::bind(&::t_struct::append, to, _1));
}
THRIFT_CONVERSION(t_const,
                  resolve_type< ::t_type>(from.type),
                  from.name,
                  convert<t_const_value>(from.value)) {
  assert(to);
  THRIFT_ASSIGN_DOC();
}

THRIFT_CONVERSION(t_function,
                  resolve_type< ::t_type>(from.returntype),
                  from.name,
                  resolve_type< ::t_struct>(from.arglist),
                  resolve_type< ::t_struct>(from.xceptions),
                  from.is_oneway) {
  assert(to);
  THRIFT_ASSIGN_DOC();
}

THRIFT_CONVERSION(t_service, g_program_cache[from.metadata.program_id]) {
  assert(to);
  assert(from.metadata.program_id);
  assert(g_program_cache[from.metadata.program_id]);
  THRIFT_ASSIGN_METADATA();

  boost::for_each(from.functions | boost::adaptors::transformed(convert<t_function>),
                  boost::bind(&::t_service::add_function, to, _1));

  if (from.__isset.extends_)
    to->set_extends(resolve_service(from.extends_));
}

THRIFT_CONVERT_FORWARD(t_type) {
#define T_TYPE_CASE_FW_T(case, type)                                                               \
  if (from.__isset.case##_val)                                                                     \
  return convert_forward<type>(from.case##_val)
#define T_TYPE_CASE_FW(case) T_TYPE_CASE_FW_T(case, t_##case)

  T_TYPE_CASE_FW(base_type);
  T_TYPE_CASE_FW(typedef);
  T_TYPE_CASE_FW(enum);
  T_TYPE_CASE_FW(struct);
  T_TYPE_CASE_FW_T(xception, t_struct);
  T_TYPE_CASE_FW(list);
  T_TYPE_CASE_FW(set);
  T_TYPE_CASE_FW(map);
  T_TYPE_CASE_FW(service);
  throw ThriftPluginError("Invalid data: Type union has no value.");
#undef T_TYPE_CASE_FW_T
#undef T_TYPE_CASE_FW
}
THRIFT_CONVERT_COMPLETE(t_type) {
#define T_TYPE_CASE_T(case, type)                                                                  \
  else if (from.__isset.case##_val)                                                                \
      convert<type, ::type>(from.case##_val, reinterpret_cast< ::type*>(to))
#define T_TYPE_CASE(case) T_TYPE_CASE_T(case, t_##case)

  if (false) {
  }
  T_TYPE_CASE(base_type);
  T_TYPE_CASE(typedef);
  T_TYPE_CASE(enum);
  T_TYPE_CASE(struct);
  T_TYPE_CASE_T(xception, t_struct);
  T_TYPE_CASE(list);
  T_TYPE_CASE(set);
  T_TYPE_CASE(map);
  T_TYPE_CASE(service);
  else {
    throw ThriftPluginError("Invalid data: Type union has no value.");
  }
#undef T_TYPE_CASE_T
#undef T_TYPE_CASE
}

THRIFT_CONVERSION(t_scope, ) {
  assert(to);
#define T_SCOPE_RESOLVE(type, name, a)                                                             \
  for (std::vector<int64_t>::const_iterator it = from.name##s.begin(); it != from.name##s.end();   \
       it++) {                                                                                     \
    ::t_##type* t = resolve_##type a(*it);                                                         \
    to->add_##name(t->get_name(), t);                                                              \
  }
  T_SCOPE_RESOLVE(type, type, < ::t_type>);
  T_SCOPE_RESOLVE(const, constant, );
  T_SCOPE_RESOLVE(service, service, );
#undef T_SCOPE_RESOLVE
}

THRIFT_CONVERT_FORWARD(t_program) {
  ::t_program* to = new ::t_program(from.path, from.name);
  for (std::vector<t_program>::const_iterator it = from.includes.begin(); it != from.includes.end();
       it++) {
    to->add_include(convert_forward(*it));
  }
  g_program_cache[from.program_id] = to;
  return to;
}
THRIFT_CONVERT_COMPLETE(t_program) {
  assert(to);
  g_program = to;
  convert<t_scope, ::t_scope>(from.scope, to->scope());
  THRIFT_ASSIGN_DOC();

  to->set_out_path(from.out_path, from.out_path_is_absolute);

  boost::for_each(from.typedefs | boost::adaptors::transformed(&resolve_type< ::t_typedef>),
                  boost::bind(&::t_program::add_typedef, to, _1));
  boost::for_each(from.enums | boost::adaptors::transformed(&resolve_type< ::t_enum>),
                  boost::bind(&::t_program::add_enum, to, _1));
  for (std::vector<int64_t>::const_iterator it = from.objects.begin(); it != from.objects.end();
       it++) {
    ::t_struct* t2 = resolve_type< ::t_struct>(*it);
    if (t2->is_xception()) {
      to->add_xception(t2);
    } else {
      to->add_struct(t2);
    }
  }
  boost::for_each(from.consts | boost::adaptors::transformed(&resolve_const),
                  boost::bind(&::t_program::add_const, to, _1));
  boost::for_each(from.services | boost::adaptors::transformed(&resolve_service),
                  boost::bind(&::t_program::add_service, to, _1));

  for (std::vector<t_program>::const_iterator it = from.includes.begin(); it != from.includes.end();
       it++) {
    convert(*it, g_program_cache[it->program_id]);
  }
  std::for_each(from.c_includes.begin(), from.c_includes.end(),
                boost::bind(&::t_program::add_c_include, to, _1));
  std::for_each(from.cpp_includes.begin(), from.cpp_includes.end(),
                boost::bind(&::t_program::add_cpp_include, to, _1));
  for (std::map<std::string, std::string>::const_iterator it = from.namespaces.begin();
       it != from.namespaces.end(); it++) {
    to->set_namespace(it->first, it->second);
  }

  to->set_include_prefix(from.include_prefix);
  to->set_namespace(from.namespace_);
}

int GeneratorPlugin::exec(int, char* []) {
#ifdef _WIN32
  _setmode(fileno(stdin), _O_BINARY);
#endif
  boost::shared_ptr<TFramedTransport> transport(
      new TFramedTransport(boost::make_shared<TFDTransport>(fileno(stdin))));
  TBinaryProtocol proto(transport);
  GeneratorInput input;
  try {
    input.read(&proto);
  } catch (std::exception& err) {
    std::cerr << "Error while receiving plugin data: " << err.what() << std::endl;
    return -1;
  }
  initGlobals();
  ::t_program* p = g_program = convert_forward(input.program);
  set_global_cache(input.type_registry);
  convert(input.program, p);

  int ret = generate(p, input.parsed_options);
  clearGlobals();

  return ret;
}

::t_const_value::t_const_value_type const_value_case(const t_const_value& v) {
  if (v.__isset.map_val)
    return ::t_const_value::CV_MAP;
  if (v.__isset.list_val)
    return ::t_const_value::CV_LIST;
  if (v.__isset.string_val)
    return ::t_const_value::CV_STRING;
  if (v.__isset.integer_val)
    return ::t_const_value::CV_INTEGER;
  if (v.__isset.double_val)
    return ::t_const_value::CV_DOUBLE;
  if (v.__isset.identifier_val)
    return ::t_const_value::CV_IDENTIFIER;
  if (v.__isset.enum_val)
    return ::t_const_value::CV_IDENTIFIER;
  throw ThriftPluginError("Unknown const value type");
}

bool t_const_value::operator<(const t_const_value& that) const {
  ::t_const_value::t_const_value_type t1 = const_value_case(*this);
  ::t_const_value::t_const_value_type t2 = const_value_case(that);
  if (t1 != t2)
    return t1 < t2;
  switch (t1) {
  case ::t_const_value::CV_INTEGER:
    return integer_val < that.integer_val;
  case ::t_const_value::CV_DOUBLE:
    return double_val < that.double_val;
  case ::t_const_value::CV_STRING:
    return string_val < that.string_val;
  case ::t_const_value::CV_MAP:
    if (that.map_val.empty())
      return false;
    else if (map_val.empty())
      return true;
    else
      return map_val.begin()->first < that.map_val.begin()->first;
  case ::t_const_value::CV_LIST:
    if (that.list_val.empty())
      return false;
    else if (list_val.empty())
      return true;
    else
      return list_val.front() < that.list_val.front();
  case ::t_const_value::CV_IDENTIFIER:
    return integer_val < that.integer_val;
  }
  throw ThriftPluginError("Unknown const value type");
}
}
}
}
