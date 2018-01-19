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

#ifndef T_PROGRAM_H
#define T_PROGRAM_H

#include <map>
#include <string>
#include <vector>

// For program_name()
#include "thrift/main.h"

#include "thrift/parse/t_doc.h"
#include "thrift/parse/t_scope.h"
#include "thrift/parse/t_base_type.h"
#include "thrift/parse/t_typedef.h"
#include "thrift/parse/t_enum.h"
#include "thrift/parse/t_const.h"
#include "thrift/parse/t_struct.h"
#include "thrift/parse/t_service.h"
#include "thrift/parse/t_list.h"
#include "thrift/parse/t_map.h"
#include "thrift/parse/t_set.h"
#include "thrift/generate/t_generator_registry.h"
//#include "thrift/parse/t_doc.h"

/**
 * Top level class representing an entire thrift program. A program consists
 * fundamentally of the following:
 *
 *   Typedefs
 *   Enumerations
 *   Constants
 *   Structs
 *   Exceptions
 *   Services
 *
 * The program module also contains the definitions of the base types.
 *
 */
class t_program : public t_doc {
public:
  t_program(std::string path, std::string name)
    : path_(path), name_(name), out_path_("./"), out_path_is_absolute_(false), scope_(new t_scope) {}

  t_program(std::string path) : path_(path), out_path_("./"), out_path_is_absolute_(false) {
    name_ = program_name(path);
    scope_ = new t_scope();
  }

  ~t_program() {
    if (scope_) {
      delete scope_;
      scope_ = NULL;
    }
  }

  // Path accessor
  const std::string& get_path() const { return path_; }

  // Output path accessor
  const std::string& get_out_path() const { return out_path_; }

  // Create gen-* dir accessor
  bool is_out_path_absolute() const { return out_path_is_absolute_; }

  // Name accessor
  const std::string& get_name() const { return name_; }

  // Namespace
  const std::string& get_namespace() const { return namespace_; }

  // Include prefix accessor
  const std::string& get_include_prefix() const { return include_prefix_; }

  // Accessors for program elements
  const std::vector<t_typedef*>& get_typedefs() const { return typedefs_; }
  const std::vector<t_enum*>& get_enums() const { return enums_; }
  const std::vector<t_const*>& get_consts() const { return consts_; }
  const std::vector<t_struct*>& get_structs() const { return structs_; }
  const std::vector<t_struct*>& get_xceptions() const { return xceptions_; }
  const std::vector<t_struct*>& get_objects() const { return objects_; }
  const std::vector<t_service*>& get_services() const { return services_; }
  const std::map<std::string, std::string>& get_namespaces() const { return namespaces_; }

  // Program elements
  void add_typedef(t_typedef* td) { typedefs_.push_back(td); }
  void add_enum(t_enum* te) { enums_.push_back(te); }
  void add_const(t_const* tc) { consts_.push_back(tc); }
  void add_struct(t_struct* ts) {
    objects_.push_back(ts);
    structs_.push_back(ts);
  }
  void add_xception(t_struct* tx) {
    objects_.push_back(tx);
    xceptions_.push_back(tx);
  }
  void add_service(t_service* ts) { services_.push_back(ts); }

  // Programs to include
  const std::vector<t_program*>& get_includes() const { return includes_; }

  void set_out_path(std::string out_path, bool out_path_is_absolute) {
    out_path_ = out_path;
    out_path_is_absolute_ = out_path_is_absolute;
    // Ensure that it ends with a trailing '/' (or '\' for windows machines)
    char c = out_path_.at(out_path_.size() - 1);
    if (!(c == '/' || c == '\\')) {
      out_path_.push_back('/');
    }
  }

  // Typename collision detection
  /**
   * Search for typename collisions
   * @param t    the type to test for collisions
   * @return     true if a certain collision was found, otherwise false
   */
  bool is_unique_typename(t_type* t) {
    int occurrences = program_typename_count(this, t);
    for (std::vector<t_program*>::iterator it = includes_.begin(); it != includes_.end(); ++it) {
      occurrences += program_typename_count(*it, t);
    }
    return 0 == occurrences;
  }

  /**
   * Search all type collections for duplicate typenames
   * @param prog the program to search
   * @param t    the type to test for collisions
   * @return     the number of certain typename collisions
   */
  int program_typename_count(t_program* prog, t_type* t) {
    int occurrences = 0;
    occurrences += collection_typename_count(prog, prog->typedefs_, t);
    occurrences += collection_typename_count(prog, prog->enums_, t);
    occurrences += collection_typename_count(prog, prog->objects_, t);
    occurrences += collection_typename_count(prog, prog->services_, t);
    return occurrences;
  }

  /**
   * Search a type collection for duplicate typenames
   * @param prog            the program to search
   * @param type_collection the type collection to search
   * @param t               the type to test for collisions
   * @return                the number of certain typename collisions
   */
  template <class T>
  int collection_typename_count(t_program* prog, T type_collection, t_type* t) {
    int occurrences = 0;
    for (typename T::iterator it = type_collection.begin(); it != type_collection.end(); ++it)
      if (t != *it && 0 == t->get_name().compare((*it)->get_name()) && is_common_namespace(prog, t))
        ++occurrences;
    return occurrences;
  }

  /**
   * Determine whether identical typenames will collide based on namespaces.
   *
   * Because we do not know which languages the user will generate code for,
   * collisions within programs (IDL files) having namespace declarations can be
   * difficult to determine. Only guaranteed collisions return true (cause an error).
   * Possible collisions involving explicit namespace declarations produce a warning.
   * Other possible collisions go unreported.
   * @param prog the program containing the preexisting typename
   * @param t    the type containing the typename match
   * @return     true if a collision within namespaces is found, otherwise false
   */
  bool is_common_namespace(t_program* prog, t_type* t) {
    // Case 1: Typenames are in the same program [collision]
    if (prog == t->get_program()) {
      pwarning(1,
               "Duplicate typename %s found in %s",
               t->get_name().c_str(),
               t->get_program()->get_name().c_str());
      return true;
    }

    // Case 2: Both programs have identical namespace scope/name declarations [collision]
    bool match = true;
    for (std::map<std::string, std::string>::iterator it = prog->namespaces_.begin();
         it != prog->namespaces_.end();
         ++it) {
      if (0 == it->second.compare(t->get_program()->get_namespace(it->first))) {
        pwarning(1,
                 "Duplicate typename %s found in %s,%s,%s and %s,%s,%s [file,scope,ns]",
                 t->get_name().c_str(),
                 t->get_program()->get_name().c_str(),
                 it->first.c_str(),
                 it->second.c_str(),
                 prog->get_name().c_str(),
                 it->first.c_str(),
                 it->second.c_str());
      } else {
        match = false;
      }
    }
    for (std::map<std::string, std::string>::iterator it = t->get_program()->namespaces_.begin();
         it != t->get_program()->namespaces_.end();
         ++it) {
      if (0 == it->second.compare(prog->get_namespace(it->first))) {
        pwarning(1,
                 "Duplicate typename %s found in %s,%s,%s and %s,%s,%s [file,scope,ns]",
                 t->get_name().c_str(),
                 t->get_program()->get_name().c_str(),
                 it->first.c_str(),
                 it->second.c_str(),
                 prog->get_name().c_str(),
                 it->first.c_str(),
                 it->second.c_str());
      } else {
        match = false;
      }
    }
    if (0 == prog->namespaces_.size() && 0 == t->get_program()->namespaces_.size()) {
      pwarning(1,
               "Duplicate typename %s found in %s and %s",
               t->get_name().c_str(),
               t->get_program()->get_name().c_str(),
               prog->get_name().c_str());
    }
    return match;
  }

  // Scoping and namespacing
  void set_namespace(std::string name) { namespace_ = name; }

  // Scope accessor
  t_scope* scope() const { return scope_; }

  // Includes

  void add_include(t_program* program) {
    includes_.push_back(program);
  }

  void add_include(std::string path, std::string include_site) {
    t_program* program = new t_program(path);

    // include prefix for this program is the site at which it was included
    // (minus the filename)
    std::string include_prefix;
    std::string::size_type last_slash = std::string::npos;
    if ((last_slash = include_site.rfind("/")) != std::string::npos) {
      include_prefix = include_site.substr(0, last_slash);
    }

    program->set_include_prefix(include_prefix);
    includes_.push_back(program);
  }

  std::vector<t_program*>& get_includes() { return includes_; }

  void set_include_prefix(std::string include_prefix) {
    include_prefix_ = include_prefix;

    // this is intended to be a directory; add a trailing slash if necessary
    std::string::size_type len = include_prefix_.size();
    if (len > 0 && include_prefix_[len - 1] != '/') {
      include_prefix_ += '/';
    }
  }

  // Language neutral namespace / packaging
  void set_namespace(std::string language, std::string name_space) {
    if (language != "*") {
      size_t sub_index = language.find('.');
      std::string base_language = language.substr(0, sub_index);
      std::string sub_namespace;

      if (base_language == "smalltalk") {
        pwarning(1, "Namespace 'smalltalk' is deprecated. Use 'st' instead");
        base_language = "st";
      }

      t_generator_registry::gen_map_t my_copy = t_generator_registry::get_generator_map();

      t_generator_registry::gen_map_t::iterator it;
      it = my_copy.find(base_language);

      if (it == my_copy.end()) {
        std::string warning = "No generator named '" + base_language + "' could be found!";
        pwarning(1, warning.c_str());
      } else {
        if (sub_index != std::string::npos) {
          std::string sub_namespace = language.substr(sub_index + 1);
          if (!it->second->is_valid_namespace(sub_namespace)) {
            std::string warning = base_language + " generator does not accept '" + sub_namespace
                                  + "' as sub-namespace!";
            pwarning(1, warning.c_str());
          }
        }
      }
    }

    namespaces_[language] = name_space;
  }

  std::string get_namespace(std::string language) const {
    std::map<std::string, std::string>::const_iterator iter;
    if ((iter = namespaces_.find(language)) != namespaces_.end()
        || (iter = namespaces_.find("*")) != namespaces_.end()) {
      return iter->second;
    }
    return std::string();
  }

  const std::map<std::string, std::string>& get_all_namespaces(){
     return namespaces_;
  }

  void set_namespace_annotations(std::string language, std::map<std::string, std::string> annotations) {
    namespace_annotations_[language] = annotations;
  }

  const std::map<std::string, std::string>& get_namespace_annotations(std::string language) {
    return namespace_annotations_[language];
  }

  // Language specific namespace / packaging

  void add_cpp_include(std::string path) { cpp_includes_.push_back(path); }

  const std::vector<std::string>& get_cpp_includes() { return cpp_includes_; }

  void add_c_include(std::string path) { c_includes_.push_back(path); }

  const std::vector<std::string>& get_c_includes() { return c_includes_; }

private:
  // File path
  std::string path_;

  // Name
  std::string name_;

  // Output directory
  std::string out_path_;

  // Output directory is absolute location for generated source (no gen-*)
  bool out_path_is_absolute_;

  // Namespace
  std::string namespace_;

  // Included programs
  std::vector<t_program*> includes_;

  // Include prefix for this program, if any
  std::string include_prefix_;

  // Identifier lookup scope
  t_scope* scope_;

  // Components to generate code for
  std::vector<t_typedef*> typedefs_;
  std::vector<t_enum*> enums_;
  std::vector<t_const*> consts_;
  std::vector<t_struct*> objects_;
  std::vector<t_struct*> structs_;
  std::vector<t_struct*> xceptions_;
  std::vector<t_service*> services_;

  // Dynamic namespaces
  std::map<std::string, std::string> namespaces_;

  // Annotations for dynamic namespaces
  std::map<std::string, std::map<std::string, std::string> > namespace_annotations_;

  // C++ extra includes
  std::vector<std::string> cpp_includes_;

  // C extra includes
  std::vector<std::string> c_includes_;
};

#endif
