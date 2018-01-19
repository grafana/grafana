Thrift PHP/Apache Integration

License
=======

Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements. See the NOTICE file
distributed with this work for additional information
regarding copyright ownership. The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License. You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied. See the License for the
specific language governing permissions and limitations
under the License.

Building PHP Thrift Services with Apache
========================================

Thrift can be embedded in the Apache webserver with PHP installed. Sample
code is provided below. Note that to make requests to this type of server
you must use a THttpClient transport.

Sample Code
===========

<?php

namespace MyNamespace;

/**
 * Include path
 */
$THRIFT_ROOT = '/your/thrift/root/lib';

/**
 * Init Autloader
 */
require_once $THRIFT_ROOT . '/Thrift/ClassLoader/ThriftClassLoader.php';

$loader = new ThriftClassLoader();
$loader->registerNamespace('Thrift', $THRIFT_ROOT);
$loader->registerDefinition('Thrift', $THRIFT_ROOT . '/packages');
$loader->register();

use Thrift\Transport\TPhpStream;
use Thrift\Protocol\TBinaryProtocol;

/**
 * Example of how to build a Thrift server in Apache/PHP
 */

class ServiceHandler implements ServiceIf {
  // Implement your interface and methods here
}

header('Content-Type: application/x-thrift');

$handler = new ServiceHandler();
$processor = new ServiceProcessor($handler);

// Use the TPhpStream transport to read/write directly from HTTP
$transport = new TPhpStream(TPhpStream::MODE_R | TPhpStream::MODE_W);
$protocol = new TBinaryProtocol($transport);

$transport->open();
$processor->process($protocol, $protocol);
$transport->close();
