#!/usr/bin/env php
<?php

namespace tutorial\php;

error_reporting(E_ALL);

require_once __DIR__.'/../../lib/php/lib/Thrift/ClassLoader/ThriftClassLoader.php';

use Thrift\ClassLoader\ThriftClassLoader;

$GEN_DIR = realpath(dirname(__FILE__).'/..').'/gen-php';

$loader = new ThriftClassLoader();
$loader->registerNamespace('Thrift', __DIR__ . '/../../lib/php/lib');
$loader->registerDefinition('shared', $GEN_DIR);
$loader->registerDefinition('tutorial', $GEN_DIR);
$loader->register();

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

/*
 * This is not a stand-alone server.  It should be run as a normal
 * php web script (like through Apache's mod_php) or as a cgi script
 * (like with the included runserver.py).  You can connect to it with
 * THttpClient in any language that supports it.  The PHP tutorial client
 * will work if you pass it the argument "--http".
 */

if (php_sapi_name() == 'cli') {
  ini_set("display_errors", "stderr");
}

use Thrift\Protocol\TBinaryProtocol;
use Thrift\Transport\TPhpStream;
use Thrift\Transport\TBufferedTransport;

class CalculatorHandler implements \tutorial\CalculatorIf {
  protected $log = array();

  public function ping() {
    error_log("ping()");
  }

  public function add($num1, $num2) {
    error_log("add({$num1}, {$num2})");
    return $num1 + $num2;
  }

  public function calculate($logid, \tutorial\Work $w) {
    error_log("calculate({$logid}, {{$w->op}, {$w->num1}, {$w->num2}})");
    switch ($w->op) {
      case \tutorial\Operation::ADD:
        $val = $w->num1 + $w->num2;
        break;
      case \tutorial\Operation::SUBTRACT:
        $val = $w->num1 - $w->num2;
        break;
      case \tutorial\Operation::MULTIPLY:
        $val = $w->num1 * $w->num2;
        break;
      case \tutorial\Operation::DIVIDE:
        if ($w->num2 == 0) {
          $io = new \tutorial\InvalidOperation();
          $io->whatOp = $w->op;
          $io->why = "Cannot divide by 0";
          throw $io;
        }
        $val = $w->num1 / $w->num2;
        break;
      default:
        $io = new \tutorial\InvalidOperation();
        $io->whatOp = $w->op;
        $io->why = "Invalid Operation";
        throw $io;
    }

    $log = new \shared\SharedStruct();
    $log->key = $logid;
    $log->value = (string)$val;
    $this->log[$logid] = $log;

    return $val;
  }

  public function getStruct($key) {
    error_log("getStruct({$key})");
    // This actually doesn't work because the PHP interpreter is
    // restarted for every request.
    //return $this->log[$key];
    return new \shared\SharedStruct(array("key" => $key, "value" => "PHP is stateless!"));
  }

  public function zip() {
    error_log("zip()");
  }

};

header('Content-Type', 'application/x-thrift');
if (php_sapi_name() == 'cli') {
  echo "\r\n";
}

$handler = new CalculatorHandler();
$processor = new \tutorial\CalculatorProcessor($handler);

$transport = new TBufferedTransport(new TPhpStream(TPhpStream::MODE_R | TPhpStream::MODE_W));
$protocol = new TBinaryProtocol($transport, true, true);

$transport->open();
$processor->process($protocol, $protocol);
$transport->close();
