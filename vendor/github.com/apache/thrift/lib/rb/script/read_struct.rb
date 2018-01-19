#
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements. See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership. The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License. You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied. See the License for the
# specific language governing permissions and limitations
# under the License.
#

require "spec/spec_helper"

path, factory_class = ARGV

factory = eval(factory_class).new

deser = Thrift::Deserializer.new(factory)

cpts = CompactProtoTestStruct.new
CompactProtoTestStruct.constants.each do |const|
  cpts.instance_variable_set("@#{const}", nil)
end

data = File.read(path)

deser.deserialize(cpts, data)

if cpts == Fixtures::COMPACT_PROTOCOL_TEST_STRUCT
  puts "Object verified successfully!"
else
  puts "Object failed verification! Expected #{Fixtures::COMPACT_PROTOCOL_TEST_STRUCT.inspect} but got #{cpts.inspect}"
  
  puts cpts.differences(Fixtures::COMPACT_PROTOCOL_TEST_STRUCT)
end
