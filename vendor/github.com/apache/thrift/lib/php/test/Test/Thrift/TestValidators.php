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
 */

namespace test\php;

require_once __DIR__.'/../../../lib/Thrift/ClassLoader/ThriftClassLoader.php';

use Thrift\ClassLoader\ThriftClassLoader;
use Thrift\Exception\TProtocolException;
use Thrift\Protocol\TBinaryProtocol;
use Thrift\Transport\TMemoryBuffer;

$oop_mode = (isset($argv[1]) && $argv[1] === '-oop');
$GEN_DIR = $oop_mode ? 'phpvo' : 'phpv';

$loader = new ThriftClassLoader();
$loader->registerNamespace('Thrift', __DIR__ . '/../../../lib');
$loader->registerDefinition('ThriftTest', __DIR__ . '/../../packages/' . $GEN_DIR);
$loader->registerDefinition('TestValidators', __DIR__ . '/../../packages/' . $GEN_DIR);
$loader->register();

// Would be nice to have PHPUnit here, but for now just hack it.

set_exception_handler(function ($e) {
    my_assert(false, "Unexpected exception caught: " . $e->getMessage());
});

set_error_handler(function ($errno, $errmsg) {
    my_assert(false, "Unexpected PHP error: " . $errmsg);
});

// Empty structs should not have validators
assert_has_no_read_validator('ThriftTest\EmptyStruct');
assert_has_no_write_validator('ThriftTest\EmptyStruct');

// Bonk has only opt_in_req_out fields
{
    assert_has_no_read_validator('ThriftTest\Bonk');
    assert_has_a_write_validator('ThriftTest\Bonk');
    {
        // Check that we can read an empty object
        $bonk = new \ThriftTest\Bonk();
        $transport = new TMemoryBuffer("\000");
        $protocol = new TBinaryProtocol($transport);
        $bonk->read($protocol);
    }
    {
        // ...but not write an empty object
        $bonk = new \ThriftTest\Bonk();
        $transport = new TMemoryBuffer();
        $protocol = new TBinaryProtocol($transport);
        assert_protocol_exception_thrown(function () use ($bonk, $protocol) { $bonk->write($protocol); },
                                         'Bonk was able to write an empty object');
    }
}

// StructA has a single required field
{
    assert_has_a_read_validator('ThriftTest\StructA');
    assert_has_a_write_validator('ThriftTest\StructA');
    {
        // Check that we are not able to write StructA with a missing required field
        $structa = new \ThriftTest\StructA();
        $transport = new TMemoryBuffer();
        $protocol = new TBinaryProtocol($transport);
        assert_protocol_exception_thrown(function () use ($structa, $protocol) { $structa->write($protocol); },
                                         'StructA was able to write an empty object');
    }
    {
        // Check that we are able to read and write a message with a good StructA
        $transport = new TMemoryBuffer(base64_decode('CwABAAAAA2FiYwA='));
        $protocol = new TBinaryProtocol($transport);
        $structa = new \ThriftTest\StructA();
        $structa->read($protocol);
        $structa->write($protocol);
    }
}

// Unions should not get write validators
assert_has_no_write_validator('TestValidators\UnionOfStrings');

// Service _result classes should not get any validators
assert_has_no_read_validator('TestValidators\TestService_test_result');
assert_has_no_write_validator('TestValidators\TestService_test_result');

function assert_has_a_read_validator($class)
{
    my_assert(has_read_validator_method($class),
              $class . ' class should have a read validator');
}

function assert_has_no_read_validator($class)
{
    my_assert(!has_read_validator_method($class),
              $class . ' class should not have a read validator');
}

function assert_has_a_write_validator($class)
{
    my_assert(has_write_validator_method($class),
              $class . ' class should have a write validator');
}

function assert_has_no_write_validator($class)
{
    my_assert(!has_write_validator_method($class),
              $class . ' class should not have a write validator');
}

function assert_protocol_exception_thrown($callable, $message)
{
    try {
        call_user_func($callable);
        my_assert(false, $message);
    } catch (TProtocolException $e) {
    }
}

function has_write_validator_method($class)
{
    $rc = new \ReflectionClass($class);

    return $rc->hasMethod('_validateForWrite');
}

function has_read_validator_method($class)
{
    $rc = new \ReflectionClass($class);

    return $rc->hasMethod('_validateForRead');
}

function my_assert($something, $message)
{
    if (!$something) {
        fwrite(STDERR, basename(__FILE__) . " FAILED: $message\n");
        exit(1);
    }
}
