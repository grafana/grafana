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

require File.join(File.dirname(__FILE__), '../../test_helper')

require 'thrift'

class DummyTransport < Thrift::BaseTransport
  def initialize(data)
    @data = data
  end
  
  def read(size)
    @data.slice!(0, size)
  end
end

# TTransport is basically an abstract class, but isn't raising NotImplementedError
class TestThriftTransport < Test::Unit::TestCase
  def setup
    @trans = Thrift::BaseTransport.new
  end
  
  def test_open?
    assert_nil @trans.open?
  end
  
  def test_open
    assert_nil @trans.open
  end
  
  def test_close
    assert_nil @trans.close
  end
  
  # TODO:
  # This doesn't necessarily test he right thing.
  # It _looks_ like read isn't guaranteed to return the length
  # you ask for and read_all is. This means our test needs to check
  # for blocking. -- Kevin Clark 3/27/08
  def test_read_all
    # Implements read
    t = DummyTransport.new("hello")
    assert_equal "hello", t.read_all(5)
  end
  
  def test_write
    assert_nil @trans.write(5) # arbitrary value
  end
  
  def test_flush
    assert_nil @trans.flush
  end
end
