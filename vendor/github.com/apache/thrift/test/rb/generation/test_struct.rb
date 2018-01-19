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
require 'small_service'

class TestStructGeneration < Test::Unit::TestCase

  def test_default_values
    hello = TestNamespace::Hello.new

    assert_kind_of(TestNamespace::Hello, hello)
    assert_nil(hello.complexer)

    assert_equal(hello.simple, 53)
    assert_equal(hello.words, 'words')

    assert_kind_of(TestNamespace::Goodbyez, hello.thinz)
    assert_equal(hello.thinz.val, 36632)

    assert_kind_of(Hash, hello.complex)
    assert_equal(hello.complex, { 6243 => 632, 2355 => 532, 23 => 532})
    
    bool_passer = TestNamespace::BoolPasser.new(:value => false)
    assert_equal false, bool_passer.value
  end

  def test_goodbyez
    assert_equal(TestNamespace::Goodbyez.new.val, 325)
  end

end
