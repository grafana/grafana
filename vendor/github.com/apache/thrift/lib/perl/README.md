Thrift Perl Software Library

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

Using Thrift with Perl
=====================

Thrift requires Perl >= 5.6.0

Unexpected exceptions in a service handler are converted to
TApplicationException with type INTERNAL ERROR and the string
of the exception is delivered as the message.

On the client side, exceptions are thrown with die, so be sure
to wrap eval{} statments around any code that contains exceptions.

Please see tutoral and test dirs for examples.

Dependencies
============

Bit::Vector       - comes with modern perl installations.
Class::Accessor
IO::Socket::INET  - comes with modern perl installations.
IO::Socket::SSL   - required if using SSL/TLS.
NET::SSLeay
Crypt::SSLeay     - for make cross
