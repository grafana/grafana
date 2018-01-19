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

#ifndef T_PLUGIN_PLUGIN_H
#define T_PLUGIN_PLUGIN_H

#include "thrift/Thrift.h"

class t_program;

namespace apache {
namespace thrift {
namespace plugin {

struct ThriftPluginError : public apache::thrift::TException {
  ThriftPluginError(const std::string& msg) : apache::thrift::TException(msg) {}
};

class GeneratorPlugin {
public:
  int exec(int argc, char* argv[]);
  virtual int generate(::t_program*, const std::map<std::string, std::string>&) = 0;
};
}
}
}

#endif
