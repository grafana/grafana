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

#ifndef _THRIFT_TOSTRING_H_
#define _THRIFT_TOSTRING_H_ 1

#include <boost/lexical_cast.hpp>

#include <vector>
#include <map>
#include <set>
#include <string>
#include <sstream>

namespace apache {
namespace thrift {

template <typename T>
std::string to_string(const T& t) {
  return boost::lexical_cast<std::string>(t);
}

template <typename K, typename V>
std::string to_string(const std::map<K, V>& m);

template <typename T>
std::string to_string(const std::set<T>& s);

template <typename T>
std::string to_string(const std::vector<T>& t);

template <typename K, typename V>
std::string to_string(const typename std::pair<K, V>& v) {
  std::ostringstream o;
  o << to_string(v.first) << ": " << to_string(v.second);
  return o.str();
}

template <typename T>
std::string to_string(const T& beg, const T& end) {
  std::ostringstream o;
  for (T it = beg; it != end; ++it) {
    if (it != beg)
      o << ", ";
    o << to_string(*it);
  }
  return o.str();
}

template <typename T>
std::string to_string(const std::vector<T>& t) {
  std::ostringstream o;
  o << "[" << to_string(t.begin(), t.end()) << "]";
  return o.str();
}

template <typename K, typename V>
std::string to_string(const std::map<K, V>& m) {
  std::ostringstream o;
  o << "{" << to_string(m.begin(), m.end()) << "}";
  return o.str();
}

template <typename T>
std::string to_string(const std::set<T>& s) {
  std::ostringstream o;
  o << "{" << to_string(s.begin(), s.end()) << "}";
  return o.str();
}
}
} // apache::thrift

#endif // _THRIFT_TOSTRING_H_
