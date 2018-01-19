/*
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

#include <thrift/c_glib/thrift.h>
#include "thrift_struct.h"

G_DEFINE_ABSTRACT_TYPE(ThriftStruct, thrift_struct, G_TYPE_OBJECT)

gint32
thrift_struct_read (ThriftStruct *object, ThriftProtocol *protocol,
                    GError **error)
{
  g_return_val_if_fail (THRIFT_IS_STRUCT (object), -1);
  return THRIFT_STRUCT_GET_CLASS (object)->read (object, protocol, error);
}

gint32
thrift_struct_write (ThriftStruct *object, ThriftProtocol *protocol,
                     GError **error)
{
  g_return_val_if_fail (THRIFT_IS_STRUCT (object), -1);
  return THRIFT_STRUCT_GET_CLASS (object)->write (object, protocol, error);
}

static void
thrift_struct_class_init (ThriftStructClass *cls)
{
  cls->read = thrift_struct_read;
  cls->write = thrift_struct_write;
}

static void
thrift_struct_init (ThriftStruct *structure)
{
  THRIFT_UNUSED_VAR (structure);
}
