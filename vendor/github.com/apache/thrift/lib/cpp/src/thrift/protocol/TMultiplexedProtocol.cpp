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

#include <thrift/protocol/TMultiplexedProtocol.h>
#include <thrift/processor/TMultiplexedProcessor.h>
#include <thrift/protocol/TProtocolDecorator.h>

namespace apache {
namespace thrift {
namespace protocol {
uint32_t TMultiplexedProtocol::writeMessageBegin_virt(const std::string& _name,
                                                      const TMessageType _type,
                                                      const int32_t _seqid) {
  if (_type == T_CALL || _type == T_ONEWAY) {
    return TProtocolDecorator::writeMessageBegin_virt(serviceName + separator + _name,
                                                      _type,
                                                      _seqid);
  } else {
    return TProtocolDecorator::writeMessageBegin_virt(_name, _type, _seqid);
  }
}
}
}
}
