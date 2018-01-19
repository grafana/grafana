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

struct RecTree {
  1: list<RecTree> children
  2: i16 item
}

struct RecList {
  1: RecList & nextitem
  3: i16 item
}

struct CoRec {
  1:  CoRec2 & other
}

struct CoRec2 {
  1: CoRec other
}

struct VectorTest {
  1: list<RecList> lister;
}

service TestService
{
  RecTree echoTree(1:RecTree tree)
  RecList echoList(1:RecList lst)
  CoRec echoCoRec(1:CoRec item)
}
