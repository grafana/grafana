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

require 'spec_helper'

describe 'namespaced generation' do
  before do
    require 'namespaced_spec_namespace/namespaced_nonblocking_service'
  end

  it "generated the right files" do
    prefix = File.expand_path("../gen-rb", __FILE__)
    ["namespaced_spec_namespace/namespaced_nonblocking_service.rb",
     "namespaced_spec_namespace/thrift_namespaced_spec_constants.rb",
     "namespaced_spec_namespace/thrift_namespaced_spec_types.rb",
     "other_namespace/referenced_constants.rb",
     "other_namespace/referenced_types.rb"
    ].each do |name|
      File.exist?(File.join(prefix, name)).should be_true
    end
  end

  it "did not generate the wrong files" do
    prefix = File.expand_path("../gen-rb", __FILE__)
    ["namespaced_nonblocking_service.rb",
     "thrift_namespaced_spec_constants.rb",
     "thrift_namespaced_spec_types.rb",
     "referenced_constants.rb",
     "referenced_types.rb"
    ].each do |name|
      File.exist?(File.join(prefix, name)).should_not be_true
    end
  end

  it "has a service class in the right place" do
    defined?(NamespacedSpecNamespace::NamespacedNonblockingService).should be_true
  end

  it "has a struct in the right place" do
    defined?(NamespacedSpecNamespace::Hello).should be_true
  end

  it "required an included file" do
    defined?(OtherNamespace::SomeEnum).should be_true
  end

  it "extended a service" do
    require "extended/extended_service"
  end

end
