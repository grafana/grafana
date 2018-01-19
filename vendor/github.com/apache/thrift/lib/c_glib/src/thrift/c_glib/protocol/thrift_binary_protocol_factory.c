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
#include <thrift/c_glib/protocol/thrift_binary_protocol.h>
#include <thrift/c_glib/protocol/thrift_binary_protocol_factory.h>

G_DEFINE_TYPE(ThriftBinaryProtocolFactory, thrift_binary_protocol_factory, THRIFT_TYPE_PROTOCOL_FACTORY)

ThriftProtocol *
thrift_binary_protocol_factory_get_protocol (ThriftProtocolFactory *factory,
                                             ThriftTransport *transport)
{
  ThriftBinaryProtocol *tb = g_object_new (THRIFT_TYPE_BINARY_PROTOCOL,
                                           "transport", transport, NULL);

  THRIFT_UNUSED_VAR (factory);

  return THRIFT_PROTOCOL (tb);
}

static void
thrift_binary_protocol_factory_class_init (ThriftBinaryProtocolFactoryClass *cls)
{
  ThriftProtocolFactoryClass *protocol_factory_class = THRIFT_PROTOCOL_FACTORY_CLASS (cls);

  protocol_factory_class->get_protocol = thrift_binary_protocol_factory_get_protocol;
}

static void
thrift_binary_protocol_factory_init (ThriftBinaryProtocolFactory *factory)
{
  THRIFT_UNUSED_VAR (factory);
}
