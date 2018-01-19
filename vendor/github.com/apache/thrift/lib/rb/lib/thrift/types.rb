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

require 'set'

module Thrift
  module Types
    STOP = 0
    VOID = 1
    BOOL = 2
    BYTE = 3
    DOUBLE = 4
    I16 = 6
    I32 = 8
    I64 = 10
    STRING = 11
    STRUCT = 12
    MAP = 13
    SET = 14
    LIST = 15
  end

  class << self
    attr_accessor :type_checking
  end

  class TypeError < Exception
  end

  def self.check_type(value, field, name, skip_nil=true)
    return if value.nil? and skip_nil
    klasses = case field[:type]
              when Types::VOID
                NilClass
              when Types::BOOL
                [TrueClass, FalseClass]
              when Types::BYTE, Types::I16, Types::I32, Types::I64
                Integer
              when Types::DOUBLE
                Float
              when Types::STRING
                String
              when Types::STRUCT
                [Struct, Union]
              when Types::MAP
                Hash
              when Types::SET
                Set
              when Types::LIST
                Array
              end
    valid = klasses && [*klasses].any? { |klass| klass === value }
    raise TypeError, "Expected #{type_name(field[:type])}, received #{value.class} for field #{name}" unless valid
    # check elements now
    case field[:type]
    when Types::MAP
      value.each_pair do |k,v|
        check_type(k, field[:key], "#{name}.key", false)
        check_type(v, field[:value], "#{name}.value", false)
      end
    when Types::SET, Types::LIST
      value.each do |el|
        check_type(el, field[:element], "#{name}.element", false)
      end
    when Types::STRUCT
      raise TypeError, "Expected #{field[:class]}, received #{value.class} for field #{name}" unless field[:class] == value.class
    end
  end

  def self.type_name(type)
    Types.constants.each do |const|
      return "Types::#{const}" if Types.const_get(const) == type
    end
    nil
  end

  module MessageTypes
    CALL = 1
    REPLY = 2
    EXCEPTION = 3
    ONEWAY = 4
  end
end

Thrift.type_checking = false if Thrift.type_checking.nil?
