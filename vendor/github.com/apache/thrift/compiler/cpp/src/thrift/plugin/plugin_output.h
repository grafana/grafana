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

#ifndef T_PLUGIN_PLUGIN_OUTPUT_H
#define T_PLUGIN_PLUGIN_OUTPUT_H

#include <string>

class t_program;

namespace plugin_output {

enum PluginDelegateResult {
  PLUGIN_NOT_FOUND,
  PLUGIN_FAILURE,
  PLUGIN_SUCCEESS,
};

PluginDelegateResult delegateToPlugin(t_program* program, const std::string& options);
}

#endif
