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
 */

namespace Thrift\Protocol;

use Thrift\Type\TMessageType;

/**
 * <code>TMultiplexedProtocol</code> is a protocol-independent concrete decorator
 * that allows a Thrift client to communicate with a multiplexing Thrift server,
 * by prepending the service name to the function name during function calls.
 *
 * @package Thrift\Protocol
 */
class TMultiplexedProtocol extends TProtocolDecorator
{
    /**
     * Separator between service name and function name.
     * Should be the same as used at multiplexed Thrift server.
     *
     * @var string
     */
    const SEPARATOR = ":";

    /**
     * The name of service.
     *
     * @var string
     */
    private $serviceName_;

    /**
     * Constructor of <code>TMultiplexedProtocol</code> class.
     *
     * Wrap the specified protocol, allowing it to be used to communicate with a
     * multiplexing server.  The <code>$serviceName</code> is required as it is
     * prepended to the message header so that the multiplexing server can broker
     * the function call to the proper service.
     *
     * @param TProtocol $protocol
     * @param string    $serviceName The name of service.
     */
    public function __construct(TProtocol $protocol, $serviceName)
    {
        parent::__construct($protocol);
        $this->serviceName_ = $serviceName;
    }

    /**
     * Writes the message header.
     * Prepends the service name to the function name, separated by <code>TMultiplexedProtocol::SEPARATOR</code>.
     *
     * @param string $name  Function name.
     * @param int    $type  Message type.
     * @param int    $seqid The sequence id of this message.
     */
    public function writeMessageBegin($name, $type, $seqid)
    {
        if ($type == TMessageType::CALL || $type == TMessageType::ONEWAY) {
            $nameWithService = $this->serviceName_ . self::SEPARATOR . $name;
            parent::writeMessageBegin($nameWithService, $type, $seqid);
        } else {
            parent::writeMessageBegin($name, $type, $seqid);
        }
    }
}
