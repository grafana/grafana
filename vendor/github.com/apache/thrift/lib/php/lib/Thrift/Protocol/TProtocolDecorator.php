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
use Thrift\Exception\TException;

/**
 * <code>TProtocolDecorator</code> forwards all requests to an enclosed
 * <code>TProtocol</code> instance, providing a way to author concise
 * concrete decorator subclasses. While it has no abstract methods, it
 * is marked abstract as a reminder that by itself, it does not modify
 * the behaviour of the enclosed <code>TProtocol</code>.
 *
 * @package Thrift\Protocol
 */
abstract class TProtocolDecorator extends TProtocol
{
    /**
     * Instance of protocol, to which all operations will be forwarded.
     *
     * @var TProtocol
     */
    private $concreteProtocol_;

    /**
     * Constructor of <code>TProtocolDecorator</code> class.
     * Encloses the specified protocol.
     *
     * @param TProtocol $protocol All operations will be forward to this instance. Must be non-null.
     */
    protected function __construct(TProtocol $protocol)
    {
        parent::__construct($protocol->getTransport());
        $this->concreteProtocol_ = $protocol;
    }

    /**
     * Writes the message header.
     *
     * @param string $name  Function name
     * @param int    $type  message type TMessageType::CALL or TMessageType::REPLY
     * @param int    $seqid The sequence id of this message
     */
    public function writeMessageBegin($name, $type, $seqid)
    {
        return $this->concreteProtocol_->writeMessageBegin($name, $type, $seqid);
    }

    /**
     * Closes the message.
     */
    public function writeMessageEnd()
    {
        return $this->concreteProtocol_->writeMessageEnd();
    }

    /**
     * Writes a struct header.
     *
     * @param string $name Struct name
     *
     * @throws TException on write error
     * @return int        How many bytes written
     */
    public function writeStructBegin($name)
    {
        return $this->concreteProtocol_->writeStructBegin($name);
    }

    /**
     * Close a struct.
     *
     * @throws TException on write error
     * @return int        How many bytes written
     */
    public function writeStructEnd()
    {
        return $this->concreteProtocol_->writeStructEnd();
    }

    public function writeFieldBegin($fieldName, $fieldType, $fieldId)
    {
        return $this->concreteProtocol_->writeFieldBegin($fieldName, $fieldType, $fieldId);
    }

    public function writeFieldEnd()
    {
        return $this->concreteProtocol_->writeFieldEnd();
    }

    public function writeFieldStop()
    {
        return $this->concreteProtocol_->writeFieldStop();
    }

    public function writeMapBegin($keyType, $valType, $size)
    {
        return $this->concreteProtocol_->writeMapBegin($keyType, $valType, $size);
    }

    public function writeMapEnd()
    {
        return $this->concreteProtocol_->writeMapEnd();
    }

    public function writeListBegin($elemType, $size)
    {
        return $this->concreteProtocol_->writeListBegin($elemType, $size);
    }

    public function writeListEnd()
    {
        return $this->concreteProtocol_->writeListEnd();
    }

    public function writeSetBegin($elemType, $size)
    {
        return $this->concreteProtocol_->writeSetBegin($elemType, $size);
    }

    public function writeSetEnd()
    {
        return $this->concreteProtocol_->writeSetEnd();
    }

    public function writeBool($bool)
    {
        return $this->concreteProtocol_->writeBool($bool);
    }

    public function writeByte($byte)
    {
        return $this->concreteProtocol_->writeByte($byte);
    }

    public function writeI16($i16)
    {
        return $this->concreteProtocol_->writeI16($i16);
    }

    public function writeI32($i32)
    {
        return $this->concreteProtocol_->writeI32($i32);
    }

    public function writeI64($i64)
    {
        return $this->concreteProtocol_->writeI64($i64);
    }

    public function writeDouble($dub)
    {
        return $this->concreteProtocol_->writeDouble($dub);
    }

    public function writeString($str)
    {
        return $this->concreteProtocol_->writeString($str);
    }

    /**
     * Reads the message header
     *
     * @param string $name  Function name
     * @param int    $type  message type TMessageType::CALL or TMessageType::REPLY
     * @param int    $seqid The sequence id of this message
     */
    public function readMessageBegin(&$name, &$type, &$seqid)
    {
        return $this->concreteProtocol_->readMessageBegin($name, $type, $seqid);
    }

    /**
     * Read the close of message
     */
    public function readMessageEnd()
    {
        return $this->concreteProtocol_->readMessageEnd();
    }

    public function readStructBegin(&$name)
    {
        return $this->concreteProtocol_->readStructBegin($name);
    }

    public function readStructEnd()
    {
        return $this->concreteProtocol_->readStructEnd();
    }

    public function readFieldBegin(&$name, &$fieldType, &$fieldId)
    {
        return $this->concreteProtocol_->readFieldBegin($name, $fieldType, $fieldId);
    }

    public function readFieldEnd()
    {
        return $this->concreteProtocol_->readFieldEnd();
    }

    public function readMapBegin(&$keyType, &$valType, &$size)
    {
        $this->concreteProtocol_->readMapBegin($keyType, $valType, $size);
    }

    public function readMapEnd()
    {
        return $this->concreteProtocol_->readMapEnd();
    }

    public function readListBegin(&$elemType, &$size)
    {
        $this->concreteProtocol_->readListBegin($elemType, $size);
    }

    public function readListEnd()
    {
        return $this->concreteProtocol_->readListEnd();
    }

    public function readSetBegin(&$elemType, &$size)
    {
        return $this->concreteProtocol_->readSetBegin($elemType, $size);
    }

    public function readSetEnd()
    {
        return $this->concreteProtocol_->readSetEnd();
    }

    public function readBool(&$bool)
    {
        return $this->concreteProtocol_->readBool($bool);
    }

    public function readByte(&$byte)
    {
        return $this->concreteProtocol_->readByte($byte);
    }

    public function readI16(&$i16)
    {
        return $this->concreteProtocol_->readI16($i16);
    }

    public function readI32(&$i32)
    {
        return $this->concreteProtocol_->readI32($i32);
    }

    public function readI64(&$i64)
    {
        return $this->concreteProtocol_->readI64($i64);
    }

    public function readDouble(&$dub)
    {
        return $this->concreteProtocol_->readDouble($dub);
    }

    public function readString(&$str)
    {
        return $this->concreteProtocol_->readString($str);
    }
}
