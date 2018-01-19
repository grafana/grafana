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
  module Struct_Union
    def name_to_id(name)
      names_to_ids = self.class.instance_variable_get(:@names_to_ids)
      unless names_to_ids
        names_to_ids = {}
        struct_fields.each do |fid, field_def|
          names_to_ids[field_def[:name]] = fid
        end
        self.class.instance_variable_set(:@names_to_ids, names_to_ids)
      end
      names_to_ids[name]
    end

    def sorted_field_ids
      sorted_field_ids = self.class.instance_variable_get(:@sorted_field_ids)
      unless sorted_field_ids
        sorted_field_ids = struct_fields.keys.sort
        self.class.instance_variable_set(:@sorted_field_ids, sorted_field_ids)
      end
      sorted_field_ids
    end

    def each_field
      sorted_field_ids.each do |fid|
        data = struct_fields[fid]
        yield fid, data
      end
    end

    def read_field(iprot, field = {})
      case field[:type]
      when Types::STRUCT
        value = field[:class].new
        value.read(iprot)
      when Types::MAP
        key_type, val_type, size = iprot.read_map_begin
        # Skip the map contents if the declared key or value types don't match the expected ones.
        if (size != 0 && (key_type != field[:key][:type] || val_type != field[:value][:type]))
          size.times do
            iprot.skip(key_type)
            iprot.skip(val_type)
          end
          value = nil
        else
          value = {}
          size.times do
            k = read_field(iprot, field_info(field[:key]))
            v = read_field(iprot, field_info(field[:value]))
            value[k] = v
          end
        end
        iprot.read_map_end
      when Types::LIST
        e_type, size = iprot.read_list_begin
        # Skip the list contents if the declared element type doesn't match the expected one.
        if (e_type != field[:element][:type])
          size.times do
            iprot.skip(e_type)
          end
          value = nil
        else
          value = Array.new(size) do |n|
            read_field(iprot, field_info(field[:element]))
          end
        end
        iprot.read_list_end
      when Types::SET
        e_type, size = iprot.read_set_begin
        # Skip the set contents if the declared element type doesn't match the expected one.
        if (e_type != field[:element][:type])
          size.times do
            iprot.skip(e_type)
          end
        else
          value = Set.new
          size.times do
            element = read_field(iprot, field_info(field[:element]))
            value << element
          end
        end
        iprot.read_set_end
      else
        value = iprot.read_type(field)
      end
      value
    end

    def write_data(oprot, value, field)
      if is_container? field[:type]
        write_container(oprot, value, field)
      else
        oprot.write_type(field, value)
      end
    end

    def write_container(oprot, value, field = {})
      case field[:type]
      when Types::MAP
        oprot.write_map_begin(field[:key][:type], field[:value][:type], value.size)
        value.each do |k, v|
          write_data(oprot, k, field[:key])
          write_data(oprot, v, field[:value])
        end
        oprot.write_map_end
      when Types::LIST
        oprot.write_list_begin(field[:element][:type], value.size)
        value.each do |elem|
          write_data(oprot, elem, field[:element])
        end
        oprot.write_list_end
      when Types::SET
        oprot.write_set_begin(field[:element][:type], value.size)
        value.each do |v,| # the , is to preserve compatibility with the old Hash-style sets
          write_data(oprot, v, field[:element])
        end
        oprot.write_set_end
      else
        raise "Not a container type: #{field[:type]}"
      end
    end

    CONTAINER_TYPES = []
    CONTAINER_TYPES[Types::LIST] = true
    CONTAINER_TYPES[Types::MAP] = true
    CONTAINER_TYPES[Types::SET] = true
    def is_container?(type)
      CONTAINER_TYPES[type]
    end

    def field_info(field)
      { :type => field[:type],
        :class => field[:class],
        :key => field[:key],
        :value => field[:value],
        :element => field[:element] }
    end

    def inspect_field(value, field_info)
      if enum_class = field_info[:enum_class]
        "#{enum_class.const_get(:VALUE_MAP)[value]} (#{value})"
      elsif value.is_a? Hash 
        if field_info[:type] == Types::MAP
          map_buf = []
          value.each do |k, v|
            map_buf << inspect_field(k, field_info[:key]) + ": " + inspect_field(v, field_info[:value])
          end
          "{" + map_buf.join(", ") + "}"
        else
          # old-style set
          inspect_collection(value.keys, field_info)
        end
      elsif value.is_a? Array
        inspect_collection(value, field_info)
      elsif value.is_a? Set
        inspect_collection(value, field_info)
      elsif value.is_a?(String) && field_info[:binary]
        value.unpack("H*").first
      else
        value.inspect
      end
    end
    
    def inspect_collection(collection, field_info)
      buf = []
      collection.each do |k|
        buf << inspect_field(k, field_info[:element])
      end
      "[" + buf.join(", ") + "]"      
    end
  end
end