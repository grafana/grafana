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
use Thrift\Exception\TProtocolException;
use Thrift\Protocol\SimpleJSON\Context;
use Thrift\Protocol\SimpleJSON\ListContext;
use Thrift\Protocol\SimpleJSON\StructContext;
use Thrift\Protocol\SimpleJSON\MapContext;
use Thrift\Protocol\SimpleJSON\CollectionMapKeyException;

/**
 * SimpleJSON implementation of thrift protocol, ported from Java.
 */
class TSimpleJSONProtocol extends TProtocol
{
    const COMMA = ',';
    const COLON = ':';
    const LBRACE = '{';
    const RBRACE = '}';
    const LBRACKET = '[';
    const RBRACKET = ']';
    const QUOTE = '"';

    const NAME_MAP = "map";
    const NAME_LIST = "lst";
    const NAME_SET = "set";

    protected $writeContext_ = null;
    protected $writeContextStack_ = [];

    /**
     * Push a new write context onto the stack.
     */
    protected function pushWriteContext(Context $c) {
        $this->writeContextStack_[] = $this->writeContext_;
        $this->writeContext_ = $c;
    }

    /**
     * Pop the last write context off the stack
     */
    protected function popWriteContext() {
        $this->writeContext_ = array_pop($this->writeContextStack_);
    }

    /**
     * Used to make sure that we are not encountering a map whose keys are containers
     */
    protected function assertContextIsNotMapKey($invalidKeyType) {
        if ($this->writeContext_->isMapKey()) {
            throw new CollectionMapKeyException(
                "Cannot serialize a map with keys that are of type " .
                $invalidKeyType
            );
        }
    }

    private function writeJSONString($b)
    {
        $this->writeContext_->write();

        $this->trans_->write(json_encode((string)$b));
    }

    private function writeJSONInteger($num)
    {
        $isMapKey = $this->writeContext_->isMapKey();

        $this->writeContext_->write();

        if ($isMapKey) {
            $this->trans_->write(self::QUOTE);
        }

        $this->trans_->write((int)$num);

        if ($isMapKey) {
            $this->trans_->write(self::QUOTE);
        }
    }

    private function writeJSONDouble($num)
    {
        $isMapKey = $this->writeContext_->isMapKey();

        $this->writeContext_->write();

        if ($isMapKey) {
            $this->trans_->write(self::QUOTE);
        }

        $this->trans_->write(json_encode((float)$num));

        if ($isMapKey) {
            $this->trans_->write(self::QUOTE);
        }
    }

    /**
     * Constructor
     */
    public function __construct($trans)
    {
        parent::__construct($trans);
        $this->writeContext_ = new Context();
    }

    /**
     * Writes the message header
     *
     * @param string $name  Function name
     * @param int    $type  message type TMessageType::CALL or TMessageType::REPLY
     * @param int    $seqid The sequence id of this message
     */
    public function writeMessageBegin($name, $type, $seqid)
    {
        $this->trans_->write(self::LBRACKET);
        $this->pushWriteContext(new ListContext($this));
        $this->writeJSONString($name);
        $this->writeJSONInteger($type);
        $this->writeJSONInteger($seqid);
    }

    /**
     * Close the message
     */
    public function writeMessageEnd()
    {
        $this->popWriteContext();
        $this->trans_->write(self::RBRACKET);
    }

    /**
     * Writes a struct header.
     *
     * @param  string     $name Struct name
     */
    public function writeStructBegin($name)
    {
        $this->writeContext_->write();
        $this->trans_->write(self::LBRACE);
        $this->pushWriteContext(new StructContext($this));
    }

    /**
     * Close a struct.
     */
    public function writeStructEnd()
    {
        $this->popWriteContext();
        $this->trans_->write(self::RBRACE);
    }

    public function writeFieldBegin($fieldName, $fieldType, $fieldId)
    {
        $this->writeJSONString($fieldName);
    }

    public function writeFieldEnd()
    {
    }

    public function writeFieldStop()
    {
    }

    public function writeMapBegin($keyType, $valType, $size)
    {
        $this->assertContextIsNotMapKey(self::NAME_MAP);
        $this->writeContext_->write();
        $this->trans_->write(self::LBRACE);
        $this->pushWriteContext(new MapContext($this));
    }

    public function writeMapEnd()
    {
        $this->popWriteContext();
        $this->trans_->write(self::RBRACE);
    }

    public function writeListBegin($elemType, $size)
    {
        $this->assertContextIsNotMapKey(self::NAME_LIST);
        $this->writeContext_->write();
        $this->trans_->write(self::LBRACKET);
        $this->pushWriteContext(new ListContext($this));
        // No metadata!
    }

    public function writeListEnd()
    {
        $this->popWriteContext();
        $this->trans_->write(self::RBRACKET);
    }

    public function writeSetBegin($elemType, $size)
    {
        $this->assertContextIsNotMapKey(self::NAME_SET);
        $this->writeContext_->write();
        $this->trans_->write(self::LBRACKET);
        $this->pushWriteContext(new ListContext($this));
        // No metadata!
    }

    public function writeSetEnd()
    {
        $this->popWriteContext();
        $this->trans_->write(self::RBRACKET);
    }

    public function writeBool($bool)
    {
        $this->writeJSONInteger($bool ? 1 : 0);
    }

    public function writeByte($byte)
    {
        $this->writeJSONInteger($byte);
    }

    public function writeI16($i16)
    {
        $this->writeJSONInteger($i16);
    }

    public function writeI32($i32)
    {
        $this->writeJSONInteger($i32);
    }

    public function writeI64($i64)
    {
        $this->writeJSONInteger($i64);
    }

    public function writeDouble($dub)
    {
        $this->writeJSONDouble($dub);
    }

    public function writeString($str)
    {
        $this->writeJSONString($str);
    }

    /**
     * Reading methods.
     *
     * simplejson is not meant to be read back into thrift
     * - see http://wiki.apache.org/thrift/ThriftUsageJava
     * - use JSON instead
     */

    public function readMessageBegin(&$name, &$type, &$seqid)
    {
        throw new TException("Not implemented");
    }

    public function readMessageEnd()
    {
        throw new TException("Not implemented");
    }

    public function readStructBegin(&$name)
    {
        throw new TException("Not implemented");
    }

    public function readStructEnd()
    {
        throw new TException("Not implemented");
    }

    public function readFieldBegin(&$name, &$fieldType, &$fieldId)
    {
        throw new TException("Not implemented");
    }

    public function readFieldEnd()
    {
        throw new TException("Not implemented");
    }

    public function readMapBegin(&$keyType, &$valType, &$size)
    {
        throw new TException("Not implemented");
    }

    public function readMapEnd()
    {
        throw new TException("Not implemented");
    }

    public function readListBegin(&$elemType, &$size)
    {
        throw new TException("Not implemented");
    }

    public function readListEnd()
    {
        throw new TException("Not implemented");
    }

    public function readSetBegin(&$elemType, &$size)
    {
        throw new TException("Not implemented");
    }

    public function readSetEnd()
    {
        throw new TException("Not implemented");
    }

    public function readBool(&$bool)
    {
        throw new TException("Not implemented");
    }

    public function readByte(&$byte)
    {
        throw new TException("Not implemented");
    }

    public function readI16(&$i16)
    {
        throw new TException("Not implemented");
    }

    public function readI32(&$i32)
    {
        throw new TException("Not implemented");
    }

    public function readI64(&$i64)
    {
        throw new TException("Not implemented");
    }

    public function readDouble(&$dub)
    {
        throw new TException("Not implemented");
    }

    public function readString(&$str)
    {
        throw new TException("Not implemented");
    }
}
