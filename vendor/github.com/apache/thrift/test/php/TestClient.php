<?php

namespace test\php;

require_once __DIR__.'/../../lib/php/lib/Thrift/ClassLoader/ThriftClassLoader.php';

use Thrift\ClassLoader\ThriftClassLoader;

if (!isset($GEN_DIR)) {
  $GEN_DIR = 'gen-php';
}
if (!isset($MODE)) {
  $MODE = 'normal';
}

$loader = new ThriftClassLoader();
$loader->registerNamespace('Thrift', __DIR__ . '/../../lib/php/lib');
if ($GEN_DIR === 'gen-php-psr4') {
  $loader->registerNamespace('ThriftTest', $GEN_DIR);
} else {
  $loader->registerDefinition('ThriftTest', $GEN_DIR);
}
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

/** Include the Thrift base */
/** Include the protocols */
use Thrift\Protocol\TBinaryProtocol;
use Thrift\Protocol\TBinaryProtocolAccelerated;
use Thrift\Protocol\TCompactProtocol;
use Thrift\Protocol\TJSONProtocol;

/** Include the socket layer */
use Thrift\Transport\TSocket;
use Thrift\Transport\TSocketPool;

/** Include the socket layer */
use Thrift\Transport\TFramedTransport;
use Thrift\Transport\TBufferedTransport;

function makeProtocol($transport, $PROTO)
{
  if ($PROTO == 'binary') {
    return new TBinaryProtocol($transport);
  } else if ($PROTO == 'compact') {
    return new TCompactProtocol($transport);
  } else if ($PROTO == 'json') {
    return new TJSONProtocol($transport);
  } else if ($PROTO == 'accel') {
    if (!function_exists('thrift_protocol_write_binary')) {
      echo "Acceleration extension is not loaded\n";
      exit(1);
    }
    return new TBinaryProtocolAccelerated($transport);
  }

  echo "--protocol must be one of {binary|compact|json|accel}\n";
  exit(1);
}

$host = 'localhost';
$port = 9090;

if ($argc > 1) {
  $host = $argv[0];
}

if ($argc > 2) {
  $host = $argv[1];
}

foreach ($argv as $arg) {
  if (substr($arg, 0, 7) == '--port=') {
    $port = substr($arg, 7);
  } else if (substr($arg, 0, 12) == '--transport=') {
    $MODE = substr($arg, 12);
  } else if (substr($arg, 0, 11) == '--protocol=') {
    $PROTO = substr($arg, 11);
  } 
}

$hosts = array('localhost');

$socket = new TSocket($host, $port);
$socket = new TSocketPool($hosts, $port);
$socket->setDebug(TRUE);

if ($MODE == 'inline') {
  $transport = $socket;
  $testClient = new \ThriftTest\ThriftTestClient($transport);
} else if ($MODE == 'framed') {
  $framedSocket = new TFramedTransport($socket);
  $transport = $framedSocket;
  $protocol = makeProtocol($transport, $PROTO);
  $testClient = new \ThriftTest\ThriftTestClient($protocol);
} else {
  $bufferedSocket = new TBufferedTransport($socket, 1024, 1024);
  $transport = $bufferedSocket;
  $protocol = makeProtocol($transport, $PROTO);
  $testClient = new \ThriftTest\ThriftTestClient($protocol);
}

$transport->open();

$start = microtime(true);

define('ERR_BASETYPES', 1);
define('ERR_STRUCTS', 2);
define('ERR_CONTAINERS', 4);
define('ERR_EXCEPTIONS', 8);
define('ERR_UNKNOWN', 64);
$exitcode = 0;
/**
 * VOID TEST
 */
print_r("testVoid()");
$testClient->testVoid();
print_r(" = void\n");

function roundtrip($testClient, $method, $value) {
  global $exitcode;
  print_r("$method($value)");
  $ret = $testClient->$method($value);
  print_r(" = \"$ret\"\n");
  if ($value !== $ret) {
    print_r("*** FAILED ***\n");
    $exitcode |= ERR_BASETYPES;
  }
}

/**
 * STRING TEST
 */
roundtrip($testClient, 'testString', "Test");

/**
 * BOOL TEST
 */
roundtrip($testClient, 'testBool', true);
roundtrip($testClient, 'testBool', false);

/**
 * BYTE TEST
 */
roundtrip($testClient, 'testByte', 1);
roundtrip($testClient, 'testByte', -1);
roundtrip($testClient, 'testByte', 127);
roundtrip($testClient, 'testByte', -128);

/**
 * I32 TEST
 */
roundtrip($testClient, 'testI32', -1);

/**
 * I64 TEST
 */
roundtrip($testClient, 'testI64', 0);
roundtrip($testClient, 'testI64', 1);
roundtrip($testClient, 'testI64', -1);
roundtrip($testClient, 'testI64', -34359738368);

/**
 * DOUBLE TEST
 */
roundtrip($testClient, 'testDouble', -852.234234234);

/**
 * BINARY TEST  --  TODO
 */

/**
 * STRUCT TEST
 */
print_r("testStruct({\"Zero\", 1, -3, -5})");
$out = new \ThriftTest\Xtruct();
$out->string_thing = "Zero";
$out->byte_thing = 1;
$out->i32_thing = -3;
$out->i64_thing = -5;
$in = $testClient->testStruct($out);
print_r(" = {\"".$in->string_thing."\", ".
        $in->byte_thing.", ".
        $in->i32_thing.", ".
        $in->i64_thing."}\n");

if ($in != $out) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

/**
 * NESTED STRUCT TEST
 */
print_r("testNest({1, {\"Zero\", 1, -3, -5}), 5}");
$out2 = new \ThriftTest\Xtruct2();
$out2->byte_thing = 1;
$out2->struct_thing = $out;
$out2->i32_thing = 5;
$in2 = $testClient->testNest($out2);
$in = $in2->struct_thing;
print_r(" = {".$in2->byte_thing.", {\"".
        $in->string_thing."\", ".
        $in->byte_thing.", ".
        $in->i32_thing.", ".
        $in->i64_thing."}, ".
        $in2->i32_thing."}\n");

if ($in2 != $out2) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

/**
 * MAP TEST
 */
$mapout = array();
for ($i = 0; $i < 5; ++$i) {
  $mapout[$i] = $i-10;
}
print_r("testMap({");
$first = true;
foreach ($mapout as $key => $val) {
  if ($first) {
    $first = false;
  } else {
    print_r(", ");
  }
  print_r("$key => $val");
}
print_r("})");

$mapin = $testClient->testMap($mapout);
print_r(" = {");
$first = true;
foreach ($mapin as $key => $val) {
  if ($first) {
    $first = false;
  } else {
    print_r(", ");
  }
  print_r("$key => $val");
}
print_r("}\n");

if ($mapin != $mapout) {
    echo "**FAILED**\n";
    $exitcode |= ERR_CONTAINERS;
}

/**
 * SET TEST
 */
$setout = array();;
for ($i = -2; $i < 3; ++$i) {
  $setout[$i]= true;
}
print_r("testSet({");
echo implode(',', array_keys($setout));
print_r("})");
$setin = $testClient->testSet($setout);
print_r(" = {");
echo implode(', ', array_keys($setin));
print_r("}\n");
// Order of keys in set does not matter
ksort($setin);
if ($setout !== $setin) {
    echo "**FAILED**\n";
    $exitcode |= ERR_CONTAINERS;
}
// Regression test for corrupted array
if ($setin[2] !== $setout[2] || is_int($setin[2])) {
    echo "**FAILED**\n";
    $exitcode |= ERR_CONTAINERS;
}

/**
 * LIST TEST
 */
$listout = array();
for ($i = -2; $i < 3; ++$i) {
  $listout []= $i;
}
print_r("testList({");
$first = true;
foreach ($listout as $val) {
  if ($first) {
    $first = false;
  } else {
    print_r(", ");
  }
  print_r($val);
}
print_r("})");
$listin = $testClient->testList($listout);
print_r(" = {");
$first = true;
foreach ($listin as $val) {
  if ($first) {
    $first = false;
  } else {
    print_r(", ");
  }
  print_r($val);
}
print_r("}\n");
if ($listin !== $listout) {
    echo "**FAILED**\n";
    $exitcode |= ERR_CONTAINERS;
}

/**
 * ENUM TEST
 */
print_r("testEnum(ONE)");
$ret = $testClient->testEnum(\ThriftTest\Numberz::ONE);
print_r(" = $ret\n");
if ($ret != \ThriftTest\Numberz::ONE) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

print_r("testEnum(TWO)");
$ret = $testClient->testEnum(\ThriftTest\Numberz::TWO);
print_r(" = $ret\n");
if ($ret != \ThriftTest\Numberz::TWO) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

print_r("testEnum(THREE)");
$ret = $testClient->testEnum(\ThriftTest\Numberz::THREE);
print_r(" = $ret\n");
if ($ret != \ThriftTest\Numberz::THREE) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

print_r("testEnum(FIVE)");
$ret = $testClient->testEnum(\ThriftTest\Numberz::FIVE);
print_r(" = $ret\n");
if ($ret != \ThriftTest\Numberz::FIVE) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

print_r("testEnum(EIGHT)");
$ret = $testClient->testEnum(\ThriftTest\Numberz::EIGHT);
print_r(" = $ret\n");
if ($ret != \ThriftTest\Numberz::EIGHT) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

/**
 * TYPEDEF TEST
 */
print_r("testTypedef(309858235082523)");
$uid = $testClient->testTypedef(309858235082523);
print_r(" = $uid\n");
if ($uid !== 309858235082523) {
    echo "**FAILED**\n";
    $exitcode |= ERR_STRUCTS;
}

/**
 * NESTED MAP TEST
 */
print_r("testMapMap(1)");
$mm = $testClient->testMapMap(1);
print_r(" = {");
foreach ($mm as $key => $val) {
  print_r("$key => {");
  foreach ($val as $k2 => $v2) {
    print_r("$k2 => $v2, ");
  }
  print_r("}, ");
}
print_r("}\n");
$expected_mm = [
  -4 => [-4 => -4, -3 => -3, -2 => -2, -1 => -1],
  4 => [4 => 4, 3 => 3, 2 => 2, 1 => 1],
];
if ($mm != $expected_mm) {
    echo "**FAILED**\n";
    $exitcode |= ERR_CONTAINERS;
}

/**
 * INSANITY TEST
 */
$insane = new \ThriftTest\Insanity();
$insane->userMap[\ThriftTest\Numberz::FIVE] = 5000;
$truck = new \ThriftTest\Xtruct();
$truck->string_thing = "Truck";
$truck->byte_thing = 8;
$truck->i32_thing = 8;
$truck->i64_thing = 8;
$insane->xtructs []= $truck;
print_r("testInsanity()");
$whoa = $testClient->testInsanity($insane);
print_r(" = {");
foreach ($whoa as $key => $val) {
  print_r("$key => {");
  foreach ($val as $k2 => $v2) {
    print_r("$k2 => {");
    $userMap = $v2->userMap;
    print_r("{");
    if (is_array($userMap)) {
      foreach ($userMap as $k3 => $v3) {
        print_r("$k3 => $v3, ");
      }
    }
    print_r("}, ");

    $xtructs = $v2->xtructs;
    print_r("{");
    if (is_array($xtructs)) {
      foreach ($xtructs as $x) {
        print_r("{\"".$x->string_thing."\", ".
                $x->byte_thing.", ".$x->i32_thing.", ".$x->i64_thing."}, ");
      }
    }
    print_r("}");

    print_r("}, ");
  }
  print_r("}, ");
}
print_r("}\n");

/**
 * EXCEPTION TEST
 */
print_r("testException('Xception')");
try {
  $testClient->testException('Xception');
  print_r("  void\nFAILURE\n");
  $exitcode |= ERR_EXCEPTIONS;
} catch (\ThriftTest\Xception $x) {
  print_r(' caught xception '.$x->errorCode.': '.$x->message."\n");
}


/**
 * Normal tests done.
 */

$stop = microtime(true);
$elp = round(1000*($stop - $start), 0);
print_r("Total time: $elp ms\n");

/**
 * Extraneous "I don't trust PHP to pack/unpack integer" tests
 */

// Max I32
$num = pow(2, 30) + (pow(2, 30) - 1);
roundtrip($testClient, 'testI32', $num);

// Min I32
$num = 0 - pow(2, 31);
roundtrip($testClient, 'testI32', $num);

// Max I64
$num = pow(2, 62) + (pow(2, 62) - 1);
roundtrip($testClient, 'testI64', $num);

// Min I64
$num = 0 - pow(2, 62) - pow(2, 62);
roundtrip($testClient, 'testI64', $num);

$transport->close();
exit($exitcode);
