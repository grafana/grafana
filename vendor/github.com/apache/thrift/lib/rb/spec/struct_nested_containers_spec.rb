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

describe 'StructNestedContainers' do

  def with_type_checking
    saved_type_checking, Thrift.type_checking = Thrift.type_checking, true
    begin
      yield
    ensure
      Thrift.type_checking = saved_type_checking
    end
  end

  describe Thrift::Struct do
    # Nested container tests, see THRIFT-369.
    it "should support nested lists inside lists" do
      with_type_checking do
        a, b = SpecNamespace::NestedListInList.new, SpecNamespace::NestedListInList.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = [ [1, 2, 3], [2, 3, 4] ]
          thrift_struct.validate
        end
        a.should == b
        b.value.push [3, 4, 5]
        a.should_not == b
      end
    end

    it "should support nested lists inside sets" do
      with_type_checking do
        a, b = SpecNamespace::NestedListInSet.new, SpecNamespace::NestedListInSet.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = [ [1, 2, 3], [2, 3, 4] ].to_set
          thrift_struct.validate
        end
        a.should == b
        b.value.add [3, 4, 5]
        a.should_not == b
      end
    end

    it "should support nested lists in map keys" do
      with_type_checking do
        a, b = SpecNamespace::NestedListInMapKey.new, SpecNamespace::NestedListInMapKey.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = { [1, 2, 3] => 1, [2, 3, 4] => 2 }
          thrift_struct.validate
        end
        a.should == b
        b.value[[3, 4, 5]] = 3
        a.should_not == b
      end
    end

    it "should support nested lists in map values" do
      with_type_checking do
        a, b = SpecNamespace::NestedListInMapValue.new, SpecNamespace::NestedListInMapValue.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = { 1 => [1, 2, 3], 2 => [2, 3, 4] }
          thrift_struct.validate
        end
        a.should == b
        b.value[3] = [3, 4, 5]
        a.should_not == b
      end
    end

    it "should support nested sets inside lists" do
      with_type_checking do
        a, b = SpecNamespace::NestedSetInList.new, SpecNamespace::NestedSetInList.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = [ [1, 2, 3].to_set, [2, 3, 4].to_set ]
          thrift_struct.validate
        end
        a.should == b
        b.value.push([3, 4, 5].to_set)
        a.should_not == b
      end
    end

    it "should support nested sets inside sets" do
      with_type_checking do
        a, b = SpecNamespace::NestedSetInSet.new, SpecNamespace::NestedSetInSet.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = [ [1, 2, 3].to_set, [2, 3, 4].to_set ].to_set
          thrift_struct.validate
        end
        a.should == b
        b.value.add([3, 4, 5].to_set)
        a.should_not == b
      end
    end

    it "should support nested sets in map keys" do
      with_type_checking do
        a, b = SpecNamespace::NestedSetInMapKey.new, SpecNamespace::NestedSetInMapKey.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = { [1, 2, 3].to_set => 1, [2, 3, 4].to_set => 2 }
          thrift_struct.validate
        end
        a.should == b
        b.value[[3, 4, 5].to_set] = 3
        a.should_not == b
      end
    end

    it "should support nested sets in map values" do
      with_type_checking do
        a, b = SpecNamespace::NestedSetInMapValue.new, SpecNamespace::NestedSetInMapValue.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = { 1 => [1, 2, 3].to_set, 2 => [2, 3, 4].to_set }
          thrift_struct.validate
        end
        a.should == b
        b.value[3] = [3, 4, 5].to_set
        a.should_not == b
      end
    end

    it "should support nested maps inside lists" do
      with_type_checking do
        a, b = SpecNamespace::NestedMapInList.new, SpecNamespace::NestedMapInList.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = [ {1 => 2, 3 => 4}, {2 => 3, 4 => 5} ]
          thrift_struct.validate
        end
        a.should == b
        b.value.push({ 3 => 4, 5 => 6 })
        a.should_not == b
      end
    end

    it "should support nested maps inside sets" do
      with_type_checking do
        a, b = SpecNamespace::NestedMapInSet.new, SpecNamespace::NestedMapInSet.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = [ {1 => 2, 3 => 4}, {2 => 3, 4 => 5} ].to_set
          thrift_struct.validate
        end
        a.should == b
        b.value.add({ 3 => 4, 5 => 6 })
        a.should_not == b
      end
    end

    it "should support nested maps in map keys" do
      with_type_checking do
        a, b = SpecNamespace::NestedMapInMapKey.new, SpecNamespace::NestedMapInMapKey.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = { { 1 => 2, 3 => 4} => 1, {2 => 3, 4 => 5}  => 2 }
          thrift_struct.validate
        end
        a.should == b
        b.value[{3 => 4, 5 => 6}] = 3
        a.should_not == b
      end
    end

    it "should support nested maps in map values" do
      with_type_checking do
        a, b = SpecNamespace::NestedMapInMapValue.new, SpecNamespace::NestedMapInMapValue.new
        [a, b].each do |thrift_struct|
          thrift_struct.value = { 1 => { 1 => 2, 3 => 4}, 2 => {2 => 3, 4 => 5} }
          thrift_struct.validate
        end
        a.should == b
        b.value[3] = { 3 => 4, 5 => 6 }
        a.should_not == b
      end
    end
  end
end
