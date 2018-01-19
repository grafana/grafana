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

use Thrift\Type\TType;
use Thrift\Exception\TProtocolException;
use Thrift\Protocol\JSON\BaseContext;
use Thrift\Protocol\JSON\LookaheadReader;
use Thrift\Protocol\JSON\PairContext;
use Thrift\Protocol\JSON\ListContext;

/**
 * JSON implementation of thrift protocol, ported from Java.
 */
class TJSONProtocol extends TProtocol
{
    const COMMA = ',';
    const COLON = ':';
    const LBRACE = '{';
    const RBRACE = '}';
    const LBRACKET = '[';
    const RBRACKET = ']';
    const QUOTE = '"';
    const BACKSLASH = '\\';
    const ZERO = '0';
    const ESCSEQ = '\\';
    const DOUBLEESC = '__DOUBLE_ESCAPE_SEQUENCE__';

    const VERSION = 1;

    public static $JSON_CHAR_TABLE = array(
        /*  0   1   2   3   4   5   6   7   8   9   A   B   C   D   E   F */
        0, 0, 0, 0, 0, 0, 0, 0, 'b', 't', 'n', 0, 'f', 'r', 0, 0, // 0
        0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, // 1
        1, 1, '"', 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, // 2
    );

    public static $ESCAPE_CHARS = array('"', '\\', '/', "b", "f", "n", "r", "t");

    public static $ESCAPE_CHAR_VALS = array(
        '"', '\\', '/', "\x08", "\f", "\n", "\r", "\t",
    );

    const NAME_BOOL = "tf";
    const NAME_BYTE = "i8";
    const NAME_I16 = "i16";
    const NAME_I32 = "i32";
    const NAME_I64 = "i64";
    const NAME_DOUBLE = "dbl";
    const NAME_STRUCT = "rec";
    const NAME_STRING = "str";
    const NAME_MAP = "map";
    const NAME_LIST = "lst";
    const NAME_SET = "set";

    private function getTypeNameForTypeID($typeID)
    {
        switch ($typeID) {
            case TType::BOOL:
                return self::NAME_BOOL;
            case TType::BYTE:
                return self::NAME_BYTE;
            case TType::I16:
                return self::NAME_I16;
            case TType::I32:
                return self::NAME_I32;
            case TType::I64:
                return self::NAME_I64;
            case TType::DOUBLE:
                return self::NAME_DOUBLE;
            case TType::STRING:
                return self::NAME_STRING;
            case TType::STRUCT:
                return self::NAME_STRUCT;
            case TType::MAP:
                return self::NAME_MAP;
            case TType::SET:
                return self::NAME_SET;
            case TType::LST:
                return self::NAME_LIST;
            default:
                throw new TProtocolException("Unrecognized type", TProtocolException::UNKNOWN);
        }
    }

    private function getTypeIDForTypeName($name)
    {
        $result = TType::STOP;

        if (strlen($name) > 1) {
            switch (substr($name, 0, 1)) {
                case 'd':
                    $result = TType::DOUBLE;
                    break;
                case 'i':
                    switch (substr($name, 1, 1)) {
                        case '8':
                            $result = TType::BYTE;
                            break;
                        case '1':
                            $result = TType::I16;
                            break;
                        case '3':
                            $result = TType::I32;
                            break;
                        case '6':
                            $result = TType::I64;
                            break;
                    }
                    break;
                case 'l':
                    $result = TType::LST;
                    break;
                case 'm':
                    $result = TType::MAP;
                    break;
                case 'r':
                    $result = TType::STRUCT;
                    break;
                case 's':
                    if (substr($name, 1, 1) == 't') {
                        $result = TType::STRING;
                    } elseif (substr($name, 1, 1) == 'e') {
                        $result = TType::SET;
                    }
                    break;
                case 't':
                    $result = TType::BOOL;
                    break;
            }
        }
        if ($result == TType::STOP) {
            throw new TProtocolException("Unrecognized type", TProtocolException::INVALID_DATA);
        }

        return $result;
    }

    public $contextStack_ = array();
    public $context_;
    public $reader_;

    private function pushContext($c)
    {
        array_push($this->contextStack_, $this->context_);
        $this->context_ = $c;
    }

    private function popContext()
    {
        $this->context_ = array_pop($this->contextStack_);
    }

    public function __construct($trans)
    {
        parent::__construct($trans);
        $this->context_ = new BaseContext();
        $this->reader_ = new LookaheadReader($this);
    }

    public function reset()
    {
        $this->contextStack_ = array();
        $this->context_ = new BaseContext();
        $this->reader_ = new LookaheadReader($this);
    }

    private $tmpbuf_ = array(4);

    public function readJSONSyntaxChar($b)
    {
        $ch = $this->reader_->read();

        if (substr($ch, 0, 1) != $b) {
            throw new TProtocolException("Unexpected character: " . $ch, TProtocolException::INVALID_DATA);
        }
    }

    private function hexVal($s)
    {
        for ($i = 0; $i < strlen($s); $i++) {
            $ch = substr($s, $i, 1);

            if (!($ch >= "a" && $ch <= "f") && !($ch >= "0" && $ch <= "9")) {
                throw new TProtocolException("Expected hex character " . $ch, TProtocolException::INVALID_DATA);
            }
        }

        return hexdec($s);
    }

    private function hexChar($val)
    {
        return dechex($val);
    }

    private function hasJSONUnescapedUnicode()
    {
        if (PHP_MAJOR_VERSION > 5
            || (PHP_MAJOR_VERSION == 5 && PHP_MINOR_VERSION >= 4))
            return true;

        return false;
    }

    private function unescapedUnicode($str)
    {
        if ($this->hasJSONUnescapedUnicode()) {
            return json_encode($str, JSON_UNESCAPED_UNICODE);
        }

        $json = json_encode($str);

        /*
         * Unescaped character outside the Basic Multilingual Plane
         * High surrogate: 0xD800 - 0xDBFF
         * Low surrogate: 0xDC00 - 0xDFFF
         */
        $json = preg_replace_callback('/\\\\u(d[89ab][0-9a-f]{2})\\\\u(d[cdef][0-9a-f]{2})/i',
            function ($matches) {
                return mb_convert_encoding(pack('H*', $matches[1].$matches[2]), 'UTF-8', 'UTF-16BE');
            }, $json);

        /*
         * Unescaped characters within the Basic Multilingual Plane
         */
        $json = preg_replace_callback('/\\\\u([0-9a-f]{4})/i',
            function ($matches) {
                return mb_convert_encoding(pack('H*', $matches[1]), 'UTF-8', 'UTF-16BE');
            }, $json);

        return $json;
    }

    private function writeJSONString($b)
    {
        $this->context_->write();

        if (is_numeric($b) && $this->context_->escapeNum()) {
            $this->trans_->write(self::QUOTE);
        }

        $this->trans_->write($this->unescapedUnicode($b));

        if (is_numeric($b) && $this->context_->escapeNum()) {
            $this->trans_->write(self::QUOTE);
        }
    }

    private function writeJSONInteger($num)
    {
        $this->context_->write();

        if ($this->context_->escapeNum()) {
            $this->trans_->write(self::QUOTE);
        }

        $this->trans_->write($num);

        if ($this->context_->escapeNum()) {
            $this->trans_->write(self::QUOTE);
        }
    }

    private function writeJSONDouble($num)
    {
        $this->context_->write();

        if ($this->context_->escapeNum()) {
            $this->trans_->write(self::QUOTE);
        }

        $this->trans_->write(json_encode($num));

        if ($this->context_->escapeNum()) {
            $this->trans_->write(self::QUOTE);
        }
    }

    private function writeJSONBase64($data)
    {
        $this->context_->write();
        $this->trans_->write(self::QUOTE);
        $this->trans_->write(json_encode(base64_encode($data)));
        $this->trans_->write(self::QUOTE);
    }

    private function writeJSONObjectStart()
    {
      $this->context_->write();
      $this->trans_->write(self::LBRACE);
      $this->pushContext(new PairContext($this));
    }

    private function writeJSONObjectEnd()
    {
      $this->popContext();
      $this->trans_->write(self::RBRACE);
    }

    private function writeJSONArrayStart()
    {
      $this->context_->write();
      $this->trans_->write(self::LBRACKET);
      $this->pushContext(new ListContext($this));
    }

    private function writeJSONArrayEnd()
    {
      $this->popContext();
      $this->trans_->write(self::RBRACKET);
    }

    private function readJSONString($skipContext)
    {
      if (!$skipContext) {
        $this->context_->read();
      }

      $jsonString = '';
      $lastChar = null;
      while (true) {
        $ch = $this->reader_->read();
        $jsonString .= $ch;
        if ($ch == self::QUOTE &&
          $lastChar !== NULL &&
            $lastChar !== self::ESCSEQ) {
          break;
        }
        if ($ch == self::ESCSEQ && $lastChar == self::ESCSEQ) {
          $lastChar = self::DOUBLEESC;
        } else {
          $lastChar = $ch;
        }
      }

      return json_decode($jsonString);
    }

    private function isJSONNumeric($b)
    {
        switch ($b) {
            case '+':
            case '-':
            case '.':
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
            case 'E':
            case 'e':
              return true;
            }

        return false;
    }

    private function readJSONNumericChars()
    {
        $strbld = array();

        while (true) {
            $ch = $this->reader_->peek();

            if (!$this->isJSONNumeric($ch)) {
                break;
            }

            $strbld[] = $this->reader_->read();
        }

        return implode("", $strbld);
    }

    private function readJSONInteger()
    {
        $this->context_->read();

        if ($this->context_->escapeNum()) {
            $this->readJSONSyntaxChar(self::QUOTE);
        }

        $str = $this->readJSONNumericChars();

        if ($this->context_->escapeNum()) {
            $this->readJSONSyntaxChar(self::QUOTE);
        }

        if (!is_numeric($str)) {
            throw new TProtocolException("Invalid data in numeric: " . $str, TProtocolException::INVALID_DATA);
        }

        return intval($str);
    }

    /**
     * Identical to readJSONInteger but without the final cast.
     * Needed for proper handling of i64 on 32 bit machines.  Why a
     * separate function?  So we don't have to force the rest of the
     * use cases through the extra conditional.
     */
    private function readJSONIntegerAsString()
    {
        $this->context_->read();

        if ($this->context_->escapeNum()) {
            $this->readJSONSyntaxChar(self::QUOTE);
        }

        $str = $this->readJSONNumericChars();

        if ($this->context_->escapeNum()) {
            $this->readJSONSyntaxChar(self::QUOTE);
        }

        if (!is_numeric($str)) {
            throw new TProtocolException("Invalid data in numeric: " . $str, TProtocolException::INVALID_DATA);
        }

        return $str;
    }

    private function readJSONDouble()
    {
        $this->context_->read();

        if (substr($this->reader_->peek(), 0, 1) == self::QUOTE) {
            $arr = $this->readJSONString(true);

            if ($arr == "NaN") {
                return NAN;
            } elseif ($arr == "Infinity") {
                return INF;
            } elseif (!$this->context_->escapeNum()) {
                throw new TProtocolException("Numeric data unexpectedly quoted " . $arr,
                                              TProtocolException::INVALID_DATA);
            }

            return floatval($arr);
        } else {
            if ($this->context_->escapeNum()) {
                $this->readJSONSyntaxChar(self::QUOTE);
            }

            return floatval($this->readJSONNumericChars());
        }
    }

    private function readJSONBase64()
    {
        $arr = $this->readJSONString(false);
        $data = base64_decode($arr, true);

        if ($data === false) {
            throw new TProtocolException("Invalid base64 data " . $arr, TProtocolException::INVALID_DATA);
        }

        return $data;
    }

    private function readJSONObjectStart()
    {
        $this->context_->read();
        $this->readJSONSyntaxChar(self::LBRACE);
        $this->pushContext(new PairContext($this));
    }

    private function readJSONObjectEnd()
    {
        $this->readJSONSyntaxChar(self::RBRACE);
        $this->popContext();
    }

    private function readJSONArrayStart()
    {
        $this->context_->read();
        $this->readJSONSyntaxChar(self::LBRACKET);
        $this->pushContext(new ListContext($this));
    }

    private function readJSONArrayEnd()
    {
        $this->readJSONSyntaxChar(self::RBRACKET);
        $this->popContext();
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
        $this->writeJSONArrayStart();
        $this->writeJSONInteger(self::VERSION);
        $this->writeJSONString($name);
        $this->writeJSONInteger($type);
        $this->writeJSONInteger($seqid);
    }

    /**
     * Close the message
     */
    public function writeMessageEnd()
    {
        $this->writeJSONArrayEnd();
    }

    /**
     * Writes a struct header.
     *
     * @param  string     $name Struct name
     * @throws TException on write error
     * @return int        How many bytes written
     */
    public function writeStructBegin($name)
    {
        $this->writeJSONObjectStart();
    }

    /**
     * Close a struct.
     *
     * @throws TException on write error
     * @return int        How many bytes written
     */
    public function writeStructEnd()
    {
        $this->writeJSONObjectEnd();
    }

    public function writeFieldBegin($fieldName, $fieldType, $fieldId)
    {
        $this->writeJSONInteger($fieldId);
        $this->writeJSONObjectStart();
        $this->writeJSONString($this->getTypeNameForTypeID($fieldType));
    }

    public function writeFieldEnd()
    {
        $this->writeJsonObjectEnd();
    }

    public function writeFieldStop()
    {
    }

    public function writeMapBegin($keyType, $valType, $size)
    {
        $this->writeJSONArrayStart();
        $this->writeJSONString($this->getTypeNameForTypeID($keyType));
        $this->writeJSONString($this->getTypeNameForTypeID($valType));
        $this->writeJSONInteger($size);
        $this->writeJSONObjectStart();
    }

    public function writeMapEnd()
    {
        $this->writeJSONObjectEnd();
        $this->writeJSONArrayEnd();
    }

    public function writeListBegin($elemType, $size)
    {
        $this->writeJSONArrayStart();
        $this->writeJSONString($this->getTypeNameForTypeID($elemType));
        $this->writeJSONInteger($size);
    }

    public function writeListEnd()
    {
        $this->writeJSONArrayEnd();
    }

    public function writeSetBegin($elemType, $size)
    {
        $this->writeJSONArrayStart();
        $this->writeJSONString($this->getTypeNameForTypeID($elemType));
        $this->writeJSONInteger($size);
    }

    public function writeSetEnd()
    {
        $this->writeJSONArrayEnd();
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
     * Reads the message header
     *
     * @param string $name Function name
     * @param int    $type message type TMessageType::CALL or TMessageType::REPLY
     * @parem int $seqid The sequence id of this message
     */
    public function readMessageBegin(&$name, &$type, &$seqid)
    {
        $this->readJSONArrayStart();

        if ($this->readJSONInteger() != self::VERSION) {
            throw new TProtocolException("Message contained bad version", TProtocolException::BAD_VERSION);
        }

        $name = $this->readJSONString(false);
        $type = $this->readJSONInteger();
        $seqid = $this->readJSONInteger();

        return true;
    }

    /**
     * Read the close of message
     */
    public function readMessageEnd()
    {
        $this->readJSONArrayEnd();
    }

    public function readStructBegin(&$name)
    {
        $this->readJSONObjectStart();

        return 0;
    }

    public function readStructEnd()
    {
        $this->readJSONObjectEnd();
    }

    public function readFieldBegin(&$name, &$fieldType, &$fieldId)
    {
        $ch = $this->reader_->peek();
        $name = "";

        if (substr($ch, 0, 1) == self::RBRACE) {
            $fieldType = TType::STOP;
        } else {
            $fieldId = $this->readJSONInteger();
            $this->readJSONObjectStart();
            $fieldType = $this->getTypeIDForTypeName($this->readJSONString(false));
        }
    }

    public function readFieldEnd()
    {
        $this->readJSONObjectEnd();
    }

    public function readMapBegin(&$keyType, &$valType, &$size)
    {
        $this->readJSONArrayStart();
        $keyType = $this->getTypeIDForTypeName($this->readJSONString(false));
        $valType = $this->getTypeIDForTypeName($this->readJSONString(false));
        $size = $this->readJSONInteger();
        $this->readJSONObjectStart();
    }

    public function readMapEnd()
    {
        $this->readJSONObjectEnd();
        $this->readJSONArrayEnd();
    }

    public function readListBegin(&$elemType, &$size)
    {
        $this->readJSONArrayStart();
        $elemType = $this->getTypeIDForTypeName($this->readJSONString(false));
        $size = $this->readJSONInteger();

        return true;
    }

    public function readListEnd()
    {
        $this->readJSONArrayEnd();
    }

    public function readSetBegin(&$elemType, &$size)
    {
        $this->readJSONArrayStart();
        $elemType = $this->getTypeIDForTypeName($this->readJSONString(false));
        $size = $this->readJSONInteger();

        return true;
    }

    public function readSetEnd()
    {
        $this->readJSONArrayEnd();
    }

    public function readBool(&$bool)
    {
        $bool = $this->readJSONInteger() == 0 ? false : true;

        return true;
    }

    public function readByte(&$byte)
    {
        $byte = $this->readJSONInteger();

        return true;
    }

    public function readI16(&$i16)
    {
        $i16 = $this->readJSONInteger();

        return true;
    }

    public function readI32(&$i32)
    {
        $i32 = $this->readJSONInteger();

        return true;
    }

    public function readI64(&$i64)
    {
        if (PHP_INT_SIZE === 4) {
            $i64 = $this->readJSONIntegerAsString();
        } else {
            $i64 = $this->readJSONInteger();
        }

        return true;
    }

    public function readDouble(&$dub)
    {
        $dub = $this->readJSONDouble();

        return true;
    }

    public function readString(&$str)
    {
        $str = $this->readJSONString(false);

        return true;
    }
}
