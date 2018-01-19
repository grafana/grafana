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
#include "thrift/generate/t_generator.h"

namespace apache {
namespace thrift {
namespace plugin {

class MyCppGenerator : public GeneratorPlugin {
  virtual int generate(::t_program* program,
                       const std::map<std::string, std::string>& parsed_options) {
    t_generator* gen = t_generator_registry::get_generator(program, "cpp", parsed_options, "");
    gen->generate_program();
    delete gen;
    return 0;
  }
};
}
}
}

int main(int argc, char* argv[]) {
  apache::thrift::plugin::MyCppGenerator p;
  return p.exec(argc, argv);
}
