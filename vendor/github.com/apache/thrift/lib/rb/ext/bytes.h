/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License. You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

#include <ruby.h>

/*
 * A collection of utilities for working with bytes and byte buffers.
 *
 * These methods are the native analogies to some of the methods in
 * Thrift::Bytes (thrift/bytes.rb).
 */

VALUE force_binary_encoding(VALUE buffer);
VALUE convert_to_utf8_byte_buffer(VALUE string);
VALUE convert_to_string(VALUE utf8_buffer);
