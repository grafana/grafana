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

#ifdef _WIN32
#include <cstdio>
#include <fcntl.h>
#include <io.h>
#include <iostream>
#define THRIFT_POPEN(cmd) _popen(cmd, "wb")
#define THRIFT_PCLOSE _pclose
#else
#define THRIFT_POPEN(cmd) popen(cmd, "w")
#define THRIFT_PCLOSE pclose
#endif

#include "thrift/plugin/plugin_output.h"

#include <boost/range/adaptor/map.hpp>
#include <boost/range/algorithm/copy.hpp>
#include <boost/range/algorithm/transform.hpp>
#include <boost/smart_ptr.hpp>

#include "thrift/generate/t_generator.h"
#include "thrift/plugin/plugin.h"
#include "thrift/plugin/type_util.h"
#include "thrift/protocol/TBinaryProtocol.h"
#include "thrift/transport/TBufferTransports.h"
#include "thrift/transport/TFDTransport.h"

#include "thrift/plugin/plugin_types.h"

namespace plugin_output {

template <typename From>
typename apache::thrift::plugin::ToType<From>::type convert(From* from) {
  typename apache::thrift::plugin::ToType<From>::type to;
  convert(from, to);
  return to;
}

using apache::thrift::protocol::TBinaryProtocol;
using apache::thrift::transport::TFDTransport;
using apache::thrift::transport::TFramedTransport;

using namespace apache::thrift;

#define THRIFT_CONVERSION_N(from_type, to_type)                                                    \
  template <>                                                                                      \
  void convert<from_type, to_type>(from_type * from, to_type & to)
#define THRIFT_CONVERSION(type) THRIFT_CONVERSION_N(::type, plugin::type)

#define THRIFT_ASSIGN_N(from_name, to_name, prefix)                                                \
  do {                                                                                             \
    if (from)                                                                                      \
      to.__set_##to_name(prefix(from->from_name));                                                 \
  } while (0)

#define THRIFT_ASSIGN(name) THRIFT_ASSIGN_N(get_##name(), name, )
#define THRIFT_ASSIGN_CONVERT(type, from_name, to_name)                                            \
  do {                                                                                             \
    if (from && from->from_name) {                                                                 \
      to.__set_##to_name(convert(from->from_name));                                                \
    }                                                                                              \
  } while (0)

#define THRIFT_ASSIGN_OPT(name)                                                                    \
  do {                                                                                             \
    if (from->has_##name())                                                                        \
      THRIFT_ASSIGN(name);                                                                         \
  } while (0)

#define THRIFT_ASSIGN_LIST_N(type, from_name, to_name)                                             \
  do {                                                                                             \
    if (from && !from->from_name.empty()) {                                                        \
      std::transform(from->from_name.begin(),                                                      \
                     from->from_name.end(),                                                        \
                     std::back_inserter(to.to_name),                                               \
                     convert< ::type>);                                                            \
    }                                                                                              \
  } while (0)

#define THRIFT_ASSIGN_METADATA() convert(reinterpret_cast<t_type*>(from), to.metadata)

// To avoid multiple instances of same type, t_type, t_const and t_service are stored in one place
// and referenced by ID.
template <typename T>
struct TypeCache {
  typedef typename plugin::ToType<T>::type to_type;
  std::map<int64_t, to_type> cache;

  template <typename T2>
  int64_t store(T2* t) {
    intptr_t id = reinterpret_cast<intptr_t>(t);
    if (id) {
      typename std::map<int64_t, to_type>::iterator it = cache.find(id);
      if (it == cache.end()) {
        // HACK: fake resolve for recursive type
        cache.insert(std::make_pair(id, to_type()));
        // overwrite with true value
        cache[id] = convert(t);
      }
    }
    return static_cast<int64_t>(id);
  }

  void clear() { cache.clear(); }
};

template <typename T>
int64_t store_type(T* t);

#define T_STORE(type)                                                                              \
  TypeCache<t_##type> type##_cache;                                                                \
  template <>                                                                                      \
  plugin::t_##type##_id store_type<t_##type>(t_##type * t) {                                       \
    return type##_cache.store<t_##type>(t);                                                        \
  }
T_STORE(type)
T_STORE(const)
T_STORE(service)
#undef T_STORE

#define THRIFT_ASSIGN_ID_N(t, from_name, to_name)                                                  \
  do {                                                                                             \
    if (from && from->from_name)                                                                   \
      to.__set_##to_name(store_type<t>(from->from_name));                                          \
  } while (0)

#define THRIFT_ASSIGN_ID(name) THRIFT_ASSIGN_ID_N(t_type, get_##name(), name)

#define THRIFT_ASSIGN_LIST_ID(t, name)                                                             \
  do {                                                                                             \
    if (from && !from->get_##name##s().empty()) {                                                  \
      std::transform(from->get_##name##s().begin(),                                                \
                     from->get_##name##s().end(),                                                  \
                     std::back_inserter(to.name##s),                                               \
                     &store_type<t>);                                                              \
    }                                                                                              \
  } while (0)

THRIFT_CONVERSION_N(::t_type, plugin::TypeMetadata) {
  to.program_id = reinterpret_cast<int64_t>(from->get_program());
  THRIFT_ASSIGN_N(annotations_, annotations, );
  if (from->has_doc()) {
    to.__set_doc(from->get_doc());
  }
  THRIFT_ASSIGN(name);
}

THRIFT_CONVERSION(t_typedef) {
  THRIFT_ASSIGN_METADATA();
  THRIFT_ASSIGN_ID(type);
  THRIFT_ASSIGN(symbolic);
  THRIFT_ASSIGN_N(is_forward_typedef(), forward, );
}

THRIFT_CONVERSION(t_enum_value) {
  THRIFT_ASSIGN_OPT(doc);
  THRIFT_ASSIGN(name);
  THRIFT_ASSIGN(value);
}

THRIFT_CONVERSION(t_enum) {
  THRIFT_ASSIGN_METADATA();
  THRIFT_ASSIGN_LIST_N(t_enum_value, get_constants(), constants);
}

THRIFT_CONVERSION(t_const_value) {
  switch (from->get_type()) {
  case t_const_value::CV_INTEGER:
    THRIFT_ASSIGN_N(get_integer(), integer_val, );
    break;
  case t_const_value::CV_DOUBLE:
    THRIFT_ASSIGN_N(get_double(), double_val, );
    break;
  case t_const_value::CV_STRING:
    THRIFT_ASSIGN_N(get_string(), string_val, );
    break;
  case t_const_value::CV_IDENTIFIER:
    THRIFT_ASSIGN_ID_N(t_type, enum_, enum_val);
    THRIFT_ASSIGN_N(get_identifier(), identifier_val, );
    break;
  case t_const_value::CV_MAP:
    to.__isset.map_val = true;
    if (from && !from->get_map().empty()) {
      for (std::map< ::t_const_value*, ::t_const_value*>::const_iterator it
           = from->get_map().begin();
           it != from->get_map().end();
           it++) {
        to.map_val.insert(std::make_pair(convert(it->first), convert(it->second)));
      }
    }
    break;
  case t_const_value::CV_LIST:
    to.__isset.list_val = true;
    THRIFT_ASSIGN_LIST_N(t_const_value, get_list(), list_val);
    break;
  default:
    throw plugin::ThriftPluginError("const value has no value");
  }
}
THRIFT_CONVERSION(t_const) {
  THRIFT_ASSIGN_OPT(doc);
  THRIFT_ASSIGN(name);
  THRIFT_ASSIGN_ID(type);
  THRIFT_ASSIGN_CONVERT(t_const_value, get_value(), value);
}
THRIFT_CONVERSION(t_field) {
  THRIFT_ASSIGN_OPT(doc);
  THRIFT_ASSIGN(name);
  THRIFT_ASSIGN(key);
  THRIFT_ASSIGN_N(get_req(), req, (plugin::Requiredness::type));
  THRIFT_ASSIGN(reference);
  THRIFT_ASSIGN_ID(type);
  THRIFT_ASSIGN_CONVERT(t_const_value, get_value(), value);
}
THRIFT_CONVERSION(t_struct) {
  THRIFT_ASSIGN_METADATA();
  THRIFT_ASSIGN_LIST_N(t_field, get_members(), members);
  THRIFT_ASSIGN_N(is_union(), is_union, );
  THRIFT_ASSIGN_N(is_xception(), is_xception, );
}
THRIFT_CONVERSION(t_function) {
  THRIFT_ASSIGN_OPT(doc);
  THRIFT_ASSIGN(name);
  THRIFT_ASSIGN_ID(returntype);
  THRIFT_ASSIGN_N(is_oneway(), is_oneway, );
  THRIFT_ASSIGN_ID(arglist);
  THRIFT_ASSIGN_ID(xceptions);
}

THRIFT_CONVERSION(t_list) {
  THRIFT_ASSIGN_METADATA();
  THRIFT_ASSIGN_OPT(cpp_name);
  THRIFT_ASSIGN_ID(elem_type);
}
THRIFT_CONVERSION(t_set) {
  THRIFT_ASSIGN_METADATA();
  THRIFT_ASSIGN_OPT(cpp_name);
  THRIFT_ASSIGN_ID(elem_type);
}
THRIFT_CONVERSION(t_map) {
  THRIFT_ASSIGN_METADATA();
  THRIFT_ASSIGN_OPT(cpp_name);
  THRIFT_ASSIGN_ID(key_type);
  THRIFT_ASSIGN_ID(val_type);
}

THRIFT_CONVERSION(t_service) {
  THRIFT_ASSIGN_METADATA();
  THRIFT_ASSIGN_LIST_N(t_function, get_functions(), functions);
  THRIFT_ASSIGN_ID_N(t_service, get_extends(), extends_);
}

THRIFT_CONVERSION(t_base_type) {
  THRIFT_ASSIGN_METADATA();
  if (from->is_binary()) {
    to.value = plugin::t_base::TYPE_BINARY;
  } else {
    switch (from->get_base()) {
#define T_BASETYPE_CASE(name)                                                                      \
  case t_base_type::TYPE_##name:                                                                   \
    to.value = plugin::t_base::TYPE_##name;                                                        \
    break
      T_BASETYPE_CASE(VOID);
      T_BASETYPE_CASE(STRING);
      T_BASETYPE_CASE(BOOL);
      T_BASETYPE_CASE(I8);
      T_BASETYPE_CASE(I16);
      T_BASETYPE_CASE(I32);
      T_BASETYPE_CASE(I64);
      T_BASETYPE_CASE(DOUBLE);
    default:
      throw plugin::ThriftPluginError("Base type union has no value");
      break;
#undef T_BASETYPE_CASE
    }
  }
}
THRIFT_CONVERSION(t_type) {
#define T_CONVERT_UNION_N(name, type)                                                              \
  else if (from->is_##name()) {                                                                    \
    to.__isset.name##_val = true;                                                                  \
    convert(reinterpret_cast< ::type*>(from), to.name##_val);                                      \
  }
#define T_CONVERT_UNION(name) T_CONVERT_UNION_N(name, t_##name)
  if (false) {
  }
  T_CONVERT_UNION(base_type)
  T_CONVERT_UNION(typedef)
  T_CONVERT_UNION(enum)
  T_CONVERT_UNION(struct)
  T_CONVERT_UNION_N(xception, t_struct)
  T_CONVERT_UNION(list)
  T_CONVERT_UNION(set)
  T_CONVERT_UNION(map)
  T_CONVERT_UNION(service)
  else {
    throw plugin::ThriftPluginError("Type union has no value");
  }
#undef T_CONVERT_UNION_N
#undef T_CONVERT_UNION
}

THRIFT_CONVERSION(t_scope) {
#define T_SCOPE_ASSIGN(name, type)                                                                 \
  boost::copy(from->name##s_ | boost::adaptors::map_values                                         \
              | boost::adaptors::transformed(&store_type<type>),                                   \
              std::back_inserter(to.name##s))
  T_SCOPE_ASSIGN(type, t_type);
  T_SCOPE_ASSIGN(constant, t_const);
  T_SCOPE_ASSIGN(service, t_service);
#undef T_SCOPE_ASSIGN
}

void get_global_cache(plugin::TypeRegistry& reg) {
  reg.types = type_cache.cache;
  reg.constants = const_cache.cache;
  reg.services = service_cache.cache;
}

void clear_global_cache() {
  type_cache.clear();
  const_cache.clear();
  service_cache.clear();
}

THRIFT_CONVERSION(t_program) {
  THRIFT_ASSIGN_CONVERT(t_scope, scope(), scope);
  THRIFT_ASSIGN(path);
  THRIFT_ASSIGN(out_path);
  THRIFT_ASSIGN(name);
  THRIFT_ASSIGN(include_prefix);
  THRIFT_ASSIGN(cpp_includes);
  THRIFT_ASSIGN(c_includes);
  THRIFT_ASSIGN(namespaces);
  THRIFT_ASSIGN_N(is_out_path_absolute(), out_path_is_absolute, );
  THRIFT_ASSIGN_N(get_namespace(), namespace_, );
  THRIFT_ASSIGN_LIST_ID(t_type, typedef);
  THRIFT_ASSIGN_LIST_ID(t_type, enum);
  THRIFT_ASSIGN_LIST_ID(t_type, object);
  THRIFT_ASSIGN_LIST_ID(t_const, const);
  THRIFT_ASSIGN_LIST_ID(t_service, service);
  THRIFT_ASSIGN_LIST_N(t_program, get_includes(), includes);
  to.program_id = reinterpret_cast<plugin::t_program_id>(from);
}

PluginDelegateResult delegateToPlugin(t_program* program, const std::string& options) {
  std::string language;
  std::map<std::string, std::string> parsed_options;
  t_generator::parse_options(options, language, parsed_options);
  std::string cmd = "thrift-gen-";
  if (language.find_first_not_of("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_-0123456789")
      != std::string::npos) {
    std::cerr << "Invalid language name" << std::endl;
    return PLUGIN_FAILURE;
  }
  cmd.append(language);
  FILE* fd = THRIFT_POPEN(cmd.c_str());
  if (fd) {
#ifdef _WIN32
    _setmode(fileno(fd), _O_BINARY);
#endif
    boost::shared_ptr<TFramedTransport> transport(
        new TFramedTransport(boost::make_shared<TFDTransport>(fileno(fd))));
    TBinaryProtocol proto(transport);

    plugin::GeneratorInput input;
    input.__set_parsed_options(parsed_options);
    clear_global_cache();
    convert(program, input.program);
    get_global_cache(input.type_registry);
    try {
      input.write(&proto);
      transport->flush();
    } catch (std::exception& err) {
      std::cerr << "Error while sending data to plugin: " << err.what() << std::endl;
      THRIFT_PCLOSE(fd);
      return PLUGIN_FAILURE;
    }

    // TODO: be prepared for hang or crash of child process
    int ret = THRIFT_PCLOSE(fd);
    if (!ret) {
      return PLUGIN_SUCCEESS;
    } else {
      std::cerr << "plugin process returned non zero exit code: " << ret << std::endl;
      return PLUGIN_FAILURE;
    }
  }
  clear_global_cache();
  return PLUGIN_NOT_FOUND;
}
}
