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

$LOAD_PATH.unshift File.join(File.dirname(__FILE__), *%w[.. .. .. lib rb lib])
$LOAD_PATH.unshift File.join(File.dirname(__FILE__), *%w[.. .. .. lib rb ext])

require 'thrift'

require 'benchmark'
require 'rubygems'
require 'set'
require 'pp'

# require 'ruby-debug'
# require 'ruby-prof'

require File.join(File.dirname(__FILE__), '../fixtures/structs')

transport1 = Thrift::MemoryBuffer.new
ruby_binary_protocol = Thrift::BinaryProtocol.new(transport1)

transport2 = Thrift::MemoryBuffer.new
c_fast_binary_protocol = Thrift::BinaryProtocolAccelerated.new(transport2)


ooe = Fixtures::Structs::OneOfEach.new
ooe.im_true   = true
ooe.im_false  = false
ooe.a_bite    = -42
ooe.integer16 = 27000
ooe.integer32 = 1<<24
ooe.integer64 = 6000 * 1000 * 1000
ooe.double_precision = Math::PI
ooe.some_characters  = "Debug THIS!"
ooe.zomg_unicode     = "\xd7\n\a\t"

n1 = Fixtures::Structs::Nested1.new
n1.a_list = []
n1.a_list << ooe << ooe << ooe << ooe
n1.i32_map = {}
n1.i32_map[1234] = ooe
n1.i32_map[46345] = ooe
n1.i32_map[-34264] = ooe
n1.i64_map = {}
n1.i64_map[43534986783945] = ooe
n1.i64_map[-32434639875122] = ooe
n1.dbl_map = {}
n1.dbl_map[324.65469834] = ooe
n1.dbl_map[-9458672340.4986798345112] = ooe
n1.str_map = {}
n1.str_map['sdoperuix'] = ooe
n1.str_map['pwoerxclmn'] = ooe

n2 = Fixtures::Structs::Nested2.new
n2.a_list = []
n2.a_list << n1 << n1 << n1 << n1 << n1
n2.i32_map = {}
n2.i32_map[398345] = n1
n2.i32_map[-2345] = n1
n2.i32_map[12312] = n1
n2.i64_map = {}
n2.i64_map[2349843765934] = n1
n2.i64_map[-123234985495] = n1
n2.i64_map[0] = n1
n2.dbl_map = {}
n2.dbl_map[23345345.38927834] = n1
n2.dbl_map[-1232349.5489345] = n1
n2.dbl_map[-234984574.23498725] = n1
n2.str_map = {}
n2.str_map[''] = n1
n2.str_map['sdflkertpioux'] = n1
n2.str_map['sdfwepwdcjpoi'] = n1

n3 = Fixtures::Structs::Nested3.new
n3.a_list = []
n3.a_list << n2 << n2 << n2 << n2 << n2
n3.i32_map = {}
n3.i32_map[398345] = n2
n3.i32_map[-2345] = n2
n3.i32_map[12312] = n2
n3.i64_map = {}
n3.i64_map[2349843765934] = n2
n3.i64_map[-123234985495] = n2
n3.i64_map[0] = n2
n3.dbl_map = {}
n3.dbl_map[23345345.38927834] = n2
n3.dbl_map[-1232349.5489345] = n2
n3.dbl_map[-234984574.23498725] = n2
n3.str_map = {}
n3.str_map[''] = n2
n3.str_map['sdflkertpioux'] = n2
n3.str_map['sdfwepwdcjpoi'] = n2

n4 = Fixtures::Structs::Nested4.new
n4.a_list = []
n4.a_list << n3
n4.i32_map = {}
n4.i32_map[-2345] = n3
n4.i64_map = {}
n4.i64_map[2349843765934] = n3
n4.dbl_map = {}
n4.dbl_map[-1232349.5489345] = n3
n4.str_map = {}
n4.str_map[''] = n3


# prof = RubyProf.profile do
#   n4.write(c_fast_binary_protocol)
#   Fixtures::Structs::Nested4.new.read(c_fast_binary_protocol)
# end
# 
# printer = RubyProf::GraphHtmlPrinter.new(prof)
# printer.print(STDOUT, :min_percent=>0)

Benchmark.bmbm do |x|
  x.report("ruby write large (1MB) structure once") do
    n4.write(ruby_binary_protocol)
  end
  
  x.report("ruby read large (1MB) structure once") do
    Fixtures::Structs::Nested4.new.read(ruby_binary_protocol)
  end
  
  x.report("c write large (1MB) structure once") do    
    n4.write(c_fast_binary_protocol)
  end
  
  x.report("c read large (1MB) structure once") do
    Fixtures::Structs::Nested4.new.read(c_fast_binary_protocol)
  end
  
  
  
  x.report("ruby write 10_000 small structures") do
    10_000.times do
      ooe.write(ruby_binary_protocol)
    end
  end
  
  x.report("ruby read 10_000 small structures") do
    10_000.times do
      Fixtures::Structs::OneOfEach.new.read(ruby_binary_protocol)
    end
  end
  
  x.report("c write 10_000 small structures") do
    10_000.times do
      ooe.write(c_fast_binary_protocol)
    end
  end
  
  x.report("c read 10_000 small structures") do
    10_000.times do
      Fixtures::Structs::OneOfEach.new.read(c_fast_binary_protocol)
    end
  end
  
end
