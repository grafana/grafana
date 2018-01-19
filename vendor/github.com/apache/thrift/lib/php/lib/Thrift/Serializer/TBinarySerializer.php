<?php
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
 *
 * @package thrift.protocol
 * @author: rmarin (marin.radu@facebook.com)
 */

namespace Thrift\Serializer;

use Thrift\Transport\TMemoryBuffer;
use Thrift\Protocol\TBinaryProtocolAccelerated;
use Thrift\Type\TMessageType;

/**
 * Utility class for serializing and deserializing
 * a thrift object using TBinaryProtocolAccelerated.
 */
class TBinarySerializer
{
  // NOTE(rmarin): Because thrift_protocol_write_binary
  // adds a begin message prefix, you cannot specify
  // a transport in which to serialize an object. It has to
  // be a string. Otherwise we will break the compatibility with
  // normal deserialization.
  public static function serialize($object)
  {
    $transport = new TMemoryBuffer();
    $protocol = new TBinaryProtocolAccelerated($transport);
    if (function_exists('thrift_protocol_write_binary')) {
      thrift_protocol_write_binary($protocol, $object->getName(),
                                   TMessageType::REPLY, $object,
                                   0, $protocol->isStrictWrite());

      $protocol->readMessageBegin($unused_name, $unused_type,
                                  $unused_seqid);
    } else {
      $object->write($protocol);
    }
    $protocol->getTransport()->flush();

    return $transport->getBuffer();
  }

  public static function deserialize($string_object, $class_name, $buffer_size  = 8192)
  {
     $transport = new TMemoryBuffer();
     $protocol = new TBinaryProtocolAccelerated($transport);
     if (function_exists('thrift_protocol_read_binary')) {
       // NOTE (t.heintz) TBinaryProtocolAccelerated internally wraps our TMemoryBuffer in a
       // TBufferedTransport, so we have to retrieve it again or risk losing data when writing
       // less than 512 bytes to the transport (see the comment there as well).
       // @see THRIFT-1579
       $protocol->writeMessageBegin('', TMessageType::REPLY, 0);
       $protocolTransport = $protocol->getTransport();
       $protocolTransport->write($string_object);
       $protocolTransport->flush();

       return thrift_protocol_read_binary($protocol, $class_name,
                                          $protocol->isStrictRead(),
                                          $buffer_size);
     } else {
       $transport->write($string_object);
       $object = new $class_name();
       $object->read($protocol);

       return $object;
     }
  }
}
