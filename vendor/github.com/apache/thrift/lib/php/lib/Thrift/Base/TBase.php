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
 * @package thrift
 */

namespace Thrift\Base;

use Thrift\Type\TType;

/**
 * Base class from which other Thrift structs extend. This is so that we can
 * cut back on the size of the generated code which is turning out to have a
 * nontrivial cost just to load thanks to the wondrously abysmal implementation
 * of PHP. Note that code is intentionally duplicated in here to avoid making
 * function calls for every field or member of a container..
 */
abstract class TBase
{
  static $tmethod = array(TType::BOOL   => 'Bool',
                          TType::BYTE   => 'Byte',
                          TType::I16    => 'I16',
                          TType::I32    => 'I32',
                          TType::I64    => 'I64',
                          TType::DOUBLE => 'Double',
                          TType::STRING => 'String');

  abstract public function read($input);

  abstract public function write($output);

  public function __construct($spec=null, $vals=null)
  {
    if (is_array($spec) && is_array($vals)) {
      foreach ($spec as $fid => $fspec) {
        $var = $fspec['var'];
        if (isset($vals[$var])) {
          $this->$var = $vals[$var];
        }
      }
    }
  }

  public function __wakeup()
  {
    $this->__construct(get_object_vars($this));
  }

  private function _readMap(&$var, $spec, $input)
  {
    $xfer = 0;
    $ktype = $spec['ktype'];
    $vtype = $spec['vtype'];
    $kread = $vread = null;
    if (isset(TBase::$tmethod[$ktype])) {
      $kread = 'read'.TBase::$tmethod[$ktype];
    } else {
      $kspec = $spec['key'];
    }
    if (isset(TBase::$tmethod[$vtype])) {
      $vread = 'read'.TBase::$tmethod[$vtype];
    } else {
      $vspec = $spec['val'];
    }
    $var = array();
    $_ktype = $_vtype = $size = 0;
    $xfer += $input->readMapBegin($_ktype, $_vtype, $size);
    for ($i = 0; $i < $size; ++$i) {
      $key = $val = null;
      if ($kread !== null) {
        $xfer += $input->$kread($key);
      } else {
        switch ($ktype) {
        case TType::STRUCT:
          $class = $kspec['class'];
          $key = new $class();
          $xfer += $key->read($input);
          break;
        case TType::MAP:
          $xfer += $this->_readMap($key, $kspec, $input);
          break;
        case TType::LST:
          $xfer += $this->_readList($key, $kspec, $input, false);
          break;
        case TType::SET:
          $xfer += $this->_readList($key, $kspec, $input, true);
          break;
        }
      }
      if ($vread !== null) {
        $xfer += $input->$vread($val);
      } else {
        switch ($vtype) {
        case TType::STRUCT:
          $class = $vspec['class'];
          $val = new $class();
          $xfer += $val->read($input);
          break;
        case TType::MAP:
          $xfer += $this->_readMap($val, $vspec, $input);
          break;
        case TType::LST:
          $xfer += $this->_readList($val, $vspec, $input, false);
          break;
        case TType::SET:
          $xfer += $this->_readList($val, $vspec, $input, true);
          break;
        }
      }
      $var[$key] = $val;
    }
    $xfer += $input->readMapEnd();

    return $xfer;
  }

  private function _readList(&$var, $spec, $input, $set=false)
  {
    $xfer = 0;
    $etype = $spec['etype'];
    $eread = $vread = null;
    if (isset(TBase::$tmethod[$etype])) {
      $eread = 'read'.TBase::$tmethod[$etype];
    } else {
      $espec = $spec['elem'];
    }
    $var = array();
    $_etype = $size = 0;
    if ($set) {
      $xfer += $input->readSetBegin($_etype, $size);
    } else {
      $xfer += $input->readListBegin($_etype, $size);
    }
    for ($i = 0; $i < $size; ++$i) {
      $elem = null;
      if ($eread !== null) {
        $xfer += $input->$eread($elem);
      } else {
        $espec = $spec['elem'];
        switch ($etype) {
        case TType::STRUCT:
          $class = $espec['class'];
          $elem = new $class();
          $xfer += $elem->read($input);
          break;
        case TType::MAP:
          $xfer += $this->_readMap($elem, $espec, $input);
          break;
        case TType::LST:
          $xfer += $this->_readList($elem, $espec, $input, false);
          break;
        case TType::SET:
          $xfer += $this->_readList($elem, $espec, $input, true);
          break;
        }
      }
      if ($set) {
        $var[$elem] = true;
      } else {
        $var []= $elem;
      }
    }
    if ($set) {
      $xfer += $input->readSetEnd();
    } else {
      $xfer += $input->readListEnd();
    }

    return $xfer;
  }

  protected function _read($class, $spec, $input)
  {
    $xfer = 0;
    $fname = null;
    $ftype = 0;
    $fid = 0;
    $xfer += $input->readStructBegin($fname);
    while (true) {
      $xfer += $input->readFieldBegin($fname, $ftype, $fid);
      if ($ftype == TType::STOP) {
        break;
      }
      if (isset($spec[$fid])) {
        $fspec = $spec[$fid];
        $var = $fspec['var'];
        if ($ftype == $fspec['type']) {
          $xfer = 0;
          if (isset(TBase::$tmethod[$ftype])) {
            $func = 'read'.TBase::$tmethod[$ftype];
            $xfer += $input->$func($this->$var);
          } else {
            switch ($ftype) {
            case TType::STRUCT:
              $class = $fspec['class'];
              $this->$var = new $class();
              $xfer += $this->$var->read($input);
              break;
            case TType::MAP:
              $xfer += $this->_readMap($this->$var, $fspec, $input);
              break;
            case TType::LST:
              $xfer += $this->_readList($this->$var, $fspec, $input, false);
              break;
            case TType::SET:
              $xfer += $this->_readList($this->$var, $fspec, $input, true);
              break;
            }
          }
        } else {
          $xfer += $input->skip($ftype);
        }
      } else {
        $xfer += $input->skip($ftype);
      }
      $xfer += $input->readFieldEnd();
    }
    $xfer += $input->readStructEnd();

    return $xfer;
  }

  private function _writeMap($var, $spec, $output)
  {
    $xfer = 0;
    $ktype = $spec['ktype'];
    $vtype = $spec['vtype'];
    $kwrite = $vwrite = null;
    if (isset(TBase::$tmethod[$ktype])) {
      $kwrite = 'write'.TBase::$tmethod[$ktype];
    } else {
      $kspec = $spec['key'];
    }
    if (isset(TBase::$tmethod[$vtype])) {
      $vwrite = 'write'.TBase::$tmethod[$vtype];
    } else {
      $vspec = $spec['val'];
    }
    $xfer += $output->writeMapBegin($ktype, $vtype, count($var));
    foreach ($var as $key => $val) {
      if (isset($kwrite)) {
        $xfer += $output->$kwrite($key);
      } else {
        switch ($ktype) {
        case TType::STRUCT:
          $xfer += $key->write($output);
          break;
        case TType::MAP:
          $xfer += $this->_writeMap($key, $kspec, $output);
          break;
        case TType::LST:
          $xfer += $this->_writeList($key, $kspec, $output, false);
          break;
        case TType::SET:
          $xfer += $this->_writeList($key, $kspec, $output, true);
          break;
        }
      }
      if (isset($vwrite)) {
        $xfer += $output->$vwrite($val);
      } else {
        switch ($vtype) {
        case TType::STRUCT:
          $xfer += $val->write($output);
          break;
        case TType::MAP:
          $xfer += $this->_writeMap($val, $vspec, $output);
          break;
        case TType::LST:
          $xfer += $this->_writeList($val, $vspec, $output, false);
          break;
        case TType::SET:
          $xfer += $this->_writeList($val, $vspec, $output, true);
          break;
        }
      }
    }
    $xfer += $output->writeMapEnd();

    return $xfer;
  }

  private function _writeList($var, $spec, $output, $set=false)
  {
    $xfer = 0;
    $etype = $spec['etype'];
    $ewrite = null;
    if (isset(TBase::$tmethod[$etype])) {
      $ewrite = 'write'.TBase::$tmethod[$etype];
    } else {
      $espec = $spec['elem'];
    }
    if ($set) {
      $xfer += $output->writeSetBegin($etype, count($var));
    } else {
      $xfer += $output->writeListBegin($etype, count($var));
    }
    foreach ($var as $key => $val) {
      $elem = $set ? $key : $val;
      if (isset($ewrite)) {
        $xfer += $output->$ewrite($elem);
      } else {
        switch ($etype) {
        case TType::STRUCT:
          $xfer += $elem->write($output);
          break;
        case TType::MAP:
          $xfer += $this->_writeMap($elem, $espec, $output);
          break;
        case TType::LST:
          $xfer += $this->_writeList($elem, $espec, $output, false);
          break;
        case TType::SET:
          $xfer += $this->_writeList($elem, $espec, $output, true);
          break;
        }
      }
    }
    if ($set) {
      $xfer += $output->writeSetEnd();
    } else {
      $xfer += $output->writeListEnd();
    }

    return $xfer;
  }

  protected function _write($class, $spec, $output)
  {
    $xfer = 0;
    $xfer += $output->writeStructBegin($class);
    foreach ($spec as $fid => $fspec) {
      $var = $fspec['var'];
      if ($this->$var !== null) {
        $ftype = $fspec['type'];
        $xfer += $output->writeFieldBegin($var, $ftype, $fid);
        if (isset(TBase::$tmethod[$ftype])) {
          $func = 'write'.TBase::$tmethod[$ftype];
          $xfer += $output->$func($this->$var);
        } else {
          switch ($ftype) {
          case TType::STRUCT:
            $xfer += $this->$var->write($output);
            break;
          case TType::MAP:
            $xfer += $this->_writeMap($this->$var, $fspec, $output);
            break;
          case TType::LST:
            $xfer += $this->_writeList($this->$var, $fspec, $output, false);
            break;
          case TType::SET:
            $xfer += $this->_writeList($this->$var, $fspec, $output, true);
            break;
          }
        }
        $xfer += $output->writeFieldEnd();
      }
    }
    $xfer += $output->writeFieldStop();
    $xfer += $output->writeStructEnd();

    return $xfer;
  }
}
