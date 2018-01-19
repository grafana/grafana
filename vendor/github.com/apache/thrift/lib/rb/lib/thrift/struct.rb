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
  module Struct
    def initialize(d={}, &block)
      # get a copy of the default values to work on, removing defaults in favor of arguments
      fields_with_defaults = fields_with_default_values.dup
      
      # check if the defaults is empty, or if there are no parameters for this 
      # instantiation, and if so, don't bother overriding defaults.
      unless fields_with_defaults.empty? || d.empty?
        d.each_key do |name|
          fields_with_defaults.delete(name.to_s)
        end
      end
      
      # assign all the user-specified arguments
      unless d.empty?
        d.each do |name, value|
          unless name_to_id(name.to_s)
            raise Exception, "Unknown key given to #{self.class}.new: #{name}"
          end
          Thrift.check_type(value, struct_fields[name_to_id(name.to_s)], name) if Thrift.type_checking
          instance_variable_set("@#{name}", value)
        end
      end
      
      # assign all the default values
      unless fields_with_defaults.empty?
        fields_with_defaults.each do |name, default_value|
          instance_variable_set("@#{name}", (default_value.dup rescue default_value))
        end
      end
      
      yield self if block_given?
    end

    def fields_with_default_values
      fields_with_default_values = self.class.instance_variable_get(:@fields_with_default_values)
      unless fields_with_default_values
        fields_with_default_values = {}
        struct_fields.each do |fid, field_def|
          unless field_def[:default].nil?
            fields_with_default_values[field_def[:name]] = field_def[:default]
          end
        end
        self.class.instance_variable_set(:@fields_with_default_values, fields_with_default_values)
      end
      fields_with_default_values
    end
    
    def inspect(skip_optional_nulls = true)
      fields = []
      each_field do |fid, field_info|
        name = field_info[:name]
        value = instance_variable_get("@#{name}")
        unless skip_optional_nulls && field_info[:optional] && value.nil?
          fields << "#{name}:#{inspect_field(value, field_info)}"
        end
      end
      "<#{self.class} #{fields.join(", ")}>"
    end

    def read(iprot)
      iprot.read_struct_begin
      loop do
        fname, ftype, fid = iprot.read_field_begin
        break if (ftype == Types::STOP)
        handle_message(iprot, fid, ftype)
        iprot.read_field_end
      end
      iprot.read_struct_end
      validate
    end

    def write(oprot)
      validate
      oprot.write_struct_begin(self.class.name)
      each_field do |fid, field_info|
        name = field_info[:name]
        type = field_info[:type]
        value = instance_variable_get("@#{name}")
        unless value.nil?
          if is_container? type
            oprot.write_field_begin(name, type, fid)
            write_container(oprot, value, field_info)
            oprot.write_field_end
          else
            oprot.write_field(field_info, fid, value)
          end
        end
      end
      oprot.write_field_stop
      oprot.write_struct_end
    end

    def ==(other)
      return false if other.nil?
      each_field do |fid, field_info|
        name = field_info[:name]
        return false unless other.respond_to?(name) && self.send(name) == other.send(name)
      end
      true
    end

    def eql?(other)
      self.class == other.class && self == other
    end

    # This implementation of hash() is inspired by Apache's Java HashCodeBuilder class.
    def hash
      total = 17
      each_field do |fid, field_info|
        name = field_info[:name]
        value = self.send(name)
        total = (total * 37 + value.hash) & 0xffffffff
      end
      total
    end

    def differences(other)
      diffs = []
      unless other.is_a?(self.class)
        diffs << "Different class!"
      else
        each_field do |fid, field_info|
          name = field_info[:name]
          diffs << "#{name} differs!" unless self.instance_variable_get("@#{name}") == other.instance_variable_get("@#{name}")
        end
      end
      diffs
    end

    def self.field_accessor(klass, field_info)
      field_name_sym = field_info[:name].to_sym
      klass.send :attr_reader, field_name_sym
      klass.send :define_method, "#{field_info[:name]}=" do |value|
        Thrift.check_type(value, field_info, field_info[:name]) if Thrift.type_checking
        instance_variable_set("@#{field_name_sym}", value)
      end
    end

    def self.generate_accessors(klass)
      klass::FIELDS.values.each do |field_info|
        field_accessor(klass, field_info)
        qmark_isset_method(klass, field_info)
      end
    end

    def self.qmark_isset_method(klass, field_info)
      klass.send :define_method, "#{field_info[:name]}?" do
        !self.send(field_info[:name].to_sym).nil?
      end
    end

    def <=>(other)
      if self.class == other.class
        each_field do |fid, field_info|
          v1 = self.send(field_info[:name])
          v1_set = !v1.nil?
          v2 = other.send(field_info[:name])
          v2_set = !v2.nil?
          if v1_set && !v2_set
            return -1
          elsif !v1_set && v2_set
            return 1
          elsif v1_set && v2_set
            cmp = v1 <=> v2
            if cmp != 0
              return cmp
            end
          end
        end
        0
      else
        self.class <=> other.class
      end
    end

    protected

    def self.append_features(mod)
      if mod.ancestors.include? ::Exception
        mod.send :class_variable_set, :'@@__thrift_struct_real_initialize', mod.instance_method(:initialize)
        super
        # set up our custom initializer so `raise Xception, 'message'` works
        mod.send :define_method, :struct_initialize, mod.instance_method(:initialize)
        mod.send :define_method, :initialize, mod.instance_method(:exception_initialize)
      else
        super
      end
    end

    def exception_initialize(*args, &block)
      if args.size == 1 and args.first.is_a? Hash
        # looks like it's a regular Struct initialize
        method(:struct_initialize).call(args.first)
      else
        # call the Struct initializer first with no args
        # this will set our field default values
        method(:struct_initialize).call()
        # now give it to the exception
        self.class.send(:class_variable_get, :'@@__thrift_struct_real_initialize').bind(self).call(*args, &block) if args.size > 0
        # self.class.instance_method(:initialize).bind(self).call(*args, &block)
      end
    end

    def handle_message(iprot, fid, ftype)
      field = struct_fields[fid]
      if field and field[:type] == ftype
        value = read_field(iprot, field)
        instance_variable_set("@#{field[:name]}", value)
      else
        iprot.skip(ftype)
      end
    end
  end
end
