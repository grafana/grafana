Thrift PHP Software Library

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

Using Thrift with PHP
=====================

Thrift requires PHP 5. Thrift makes as few assumptions about your PHP
environment as possible while trying to make some more advanced PHP
features (i.e. APC cacheing using asbolute path URLs) as simple as possible.

To use Thrift in your PHP codebase, take the following steps:

#1) Copy all of thrift/lib/php/lib into your PHP codebase
#2) Configure Symfony Autoloader (or whatever you usually use)

After that, you have to manually include the Thrift package
created by the compiler:

require_once 'packages/Service/Service.php';
require_once 'packages/Service/Types.php';

Dependencies
============

PHP_INT_SIZE

  This built-in signals whether your architecture is 32 or 64 bit and is
  used by the TBinaryProtocol to properly use pack() and unpack() to
  serialize data.

apc_fetch(), apc_store()

  APC cache is used by the TSocketPool class. If you do not have APC installed,
  Thrift will fill in null stub function definitions.
