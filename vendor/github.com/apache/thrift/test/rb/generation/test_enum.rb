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

require File.join(File.dirname(__FILE__), '../test_helper')
require 'thrift_test'

class TestEnumGeneration < Test::Unit::TestCase
  include Thrift::Test
  def test_enum_valid_values
    assert_equal(Numberz::VALID_VALUES, Set.new([Numberz::ONE, Numberz::TWO, Numberz::THREE, Numberz::FIVE, Numberz::SIX, Numberz::EIGHT]))
  end
  
  def test_enum_hash
    Numberz::VALID_VALUES.each do |value|
      assert_equal(Numberz.const_get(Numberz::VALUE_MAP[value].to_sym), value)
    end
  end
end