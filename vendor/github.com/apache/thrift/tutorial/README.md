Thrift Tutorial

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

Tutorial
========

1) First things first, you'll need to install the Thrift compiler and the
   language libraries. Do that using the instructions in the top level
   README.md file.

2) Read tutorial.thrift to learn about the syntax of a Thrift file

3) Compile the code for the language of your choice:

     $ thrift
     $ thrift -r --gen cpp tutorial.thrift

4) Take a look at the generated code.

5) Look in the language directories for sample client/server code.

6) That's about it for now. This tutorial is intentionally brief. It should be
   just enough to get you started and ready to build your own project.
