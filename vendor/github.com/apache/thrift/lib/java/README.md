Thrift Java Software Library

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

Using Thrift with Java
======================

The Thrift Java source is not build using the GNU tools, but rather uses
the Apache Ant build system, which tends to be predominant amongst Java
developers.

To compile the Java Thrift libraries, simply do the following:

    ant

Yep, that's easy. Look for libthrift.jar in the base directory.

To include Thrift in your applications simply add libthrift.jar to your
classpath, or install if in your default system classpath of choice.


Build Thrift behind a proxy:

    ant -Dproxy.enabled=1 -Dproxy.host=myproxyhost -Dproxy.user=thriftuser -Dproxy.pass=topsecret

or via

    ./configure --with-java ANT_FLAGS='-Dproxy.enabled=1 -Dproxy.host=myproxyhost -Dproxy.user=thriftuser -Dproxy.pass=topsecret'


Dependencies
============

Apache Ant
http://ant.apache.org/
