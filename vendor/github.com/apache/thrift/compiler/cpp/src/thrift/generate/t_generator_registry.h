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

#ifndef T_GENERATOR_REGISTRY_H
#define T_GENERATOR_REGISTRY_H

class t_generator;

/**
 * A factory for producing generator classes of a particular language.
 *
 * This class is also responsible for:
 *  - Registering itself with the generator registry.
 *  - Providing documentation for the generators it produces.
 */
class t_generator_factory {
public:
  t_generator_factory(const std::string& short_name,
                      const std::string& long_name,
                      const std::string& documentation);

  virtual ~t_generator_factory() {}

  virtual t_generator* get_generator(
      // The program to generate.
      t_program* program,
      // Note: parsed_options will not exist beyond the call to get_generator.
      const std::map<std::string, std::string>& parsed_options,
      // Note: option_string might not exist beyond the call to get_generator.
      const std::string& option_string) = 0;

  virtual bool is_valid_namespace(const std::string& sub_namespace) = 0;

  std::string get_short_name() { return short_name_; }
  std::string get_long_name() { return long_name_; }
  std::string get_documentation() { return documentation_; }

private:
  std::string short_name_;
  std::string long_name_;
  std::string documentation_;
};

template <typename generator>
class t_generator_factory_impl : public t_generator_factory {
public:
  t_generator_factory_impl(const std::string& short_name,
                           const std::string& long_name,
                           const std::string& documentation)
    : t_generator_factory(short_name, long_name, documentation) {}

  virtual t_generator* get_generator(t_program* program,
                                     const std::map<std::string, std::string>& parsed_options,
                                     const std::string& option_string) {
    return new generator(program, parsed_options, option_string);
  }

  virtual bool is_valid_namespace(const std::string& sub_namespace) {
    return generator::is_valid_namespace(sub_namespace);
  }
};

class t_generator_registry {
public:
  static void register_generator(t_generator_factory* factory);

  static t_generator* get_generator(t_program* program, const std::string& options);
  static t_generator* get_generator(t_program* program,
                                    const std::string& laugnage,
                                    const std::map<std::string, std::string>& parsed_options,
                                    const std::string& options);

  typedef std::map<std::string, t_generator_factory*> gen_map_t;
  static gen_map_t& get_generator_map();

private:
  t_generator_registry();
  t_generator_registry(const t_generator_registry&);
};

#define THRIFT_REGISTER_GENERATOR(language, long_name, doc)                                        \
  class t_##language##_generator_factory_impl                                                      \
      : public t_generator_factory_impl<t_##language##_generator> {                                \
  public:                                                                                          \
    t_##language##_generator_factory_impl()                                                        \
      : t_generator_factory_impl<t_##language##_generator>(#language, long_name, doc) {}           \
  };                                                                                               \
  static t_##language##_generator_factory_impl _registerer;

#endif
