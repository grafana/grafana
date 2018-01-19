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
#include <thrift/c_glib/protocol/thrift_protocol_factory.h>

G_DEFINE_ABSTRACT_TYPE(ThriftProtocolFactory, thrift_protocol_factory, G_TYPE_OBJECT)

ThriftProtocol *
thrift_protocol_factory_get_protocol(ThriftProtocolFactory *factory,
                                     ThriftTransport *transport)
{
  return THRIFT_PROTOCOL_FACTORY_GET_CLASS (factory)->get_protocol (factory,
                                                                    transport);
}

static void
thrift_protocol_factory_init (ThriftProtocolFactory *factory)
{
  THRIFT_UNUSED_VAR (factory);
}

static void
thrift_protocol_factory_class_init (ThriftProtocolFactoryClass *cls)
{
  cls->get_protocol = thrift_protocol_factory_get_protocol;
}
