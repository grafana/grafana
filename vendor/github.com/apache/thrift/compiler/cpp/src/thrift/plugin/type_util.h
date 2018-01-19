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

#ifndef T_PLUGIN_TYPE_UTIL_H
#define T_PLUGIN_TYPE_UTIL_H

namespace apache {
namespace thrift {
namespace plugin {

template <typename From>
struct ToType {};

template <typename From>
typename ToType<From>::type* convert_forward(const From&);

template <typename From, typename To>
void convert(const From&, To*);

template <typename From>
typename ToType<From>::type* convert(const From& from);

class TypeRegistry;
void set_global_cache(const TypeRegistry&);
}
}
}

// conversion from raw compiler types to plugin wire type
namespace plugin_output {

template <typename From, typename To>
void convert(From* from, To& to);

template <typename From>
typename apache::thrift::plugin::ToType<From>::type convert(From* from);

void get_global_cache(apache::thrift::plugin::TypeRegistry&);
void clear_global_cache();
}

#define THRIFT_TYPE_MAPPING(TYPE)                                                                  \
  class TYPE;                                                                                      \
  namespace apache {                                                                               \
  namespace thrift {                                                                               \
  namespace plugin {                                                                               \
  class TYPE;                                                                                      \
  template <>                                                                                      \
  struct ToType< ::TYPE> {                                                                         \
    typedef TYPE type;                                                                             \
  };                                                                                               \
  template <>                                                                                      \
  struct ToType<TYPE> {                                                                            \
    typedef ::TYPE type;                                                                           \
  };                                                                                               \
  }                                                                                                \
  }                                                                                                \
  }
THRIFT_TYPE_MAPPING(t_base_type)
THRIFT_TYPE_MAPPING(t_const)
THRIFT_TYPE_MAPPING(t_const_value)
THRIFT_TYPE_MAPPING(t_container)
THRIFT_TYPE_MAPPING(t_doc)
THRIFT_TYPE_MAPPING(t_enum)
THRIFT_TYPE_MAPPING(t_enum_value)
THRIFT_TYPE_MAPPING(t_field)
THRIFT_TYPE_MAPPING(t_function)
THRIFT_TYPE_MAPPING(t_list)
THRIFT_TYPE_MAPPING(t_map)
THRIFT_TYPE_MAPPING(t_program)
THRIFT_TYPE_MAPPING(t_scope)
THRIFT_TYPE_MAPPING(t_service)
THRIFT_TYPE_MAPPING(t_set)
THRIFT_TYPE_MAPPING(t_struct)
THRIFT_TYPE_MAPPING(t_type)
THRIFT_TYPE_MAPPING(t_typedef)
#undef THRIFT_TYPE_MAPPING
#endif
