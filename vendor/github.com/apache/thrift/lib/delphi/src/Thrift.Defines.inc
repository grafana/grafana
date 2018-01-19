(*
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
 *)


// Good lists of Delphi version numbers
// https://github.com/project-jedi/jedi/blob/master/jedi.inc
// http://docwiki.embarcadero.com/RADStudio/Seattle/en/Compiler_Versions


// start with most backwards compatible defaults

{$DEFINE OLD_UNIT_NAMES}
{$DEFINE OLD_SOCKETS}      // TODO: add socket support for CompilerVersion >= 28.0
{$UNDEF HAVE_CLASS_CTOR}


// enable features as they are available

{$IF CompilerVersion >= 21.0}   // Delphi 2010
  {$DEFINE HAVE_CLASS_CTOR}
{$IFEND}

{$IF CompilerVersion >= 23.0}   // Delphi XE2
  {$UNDEF OLD_UNIT_NAMES}
{$IFEND}

{$IF CompilerVersion >= 28.0}   // Delphi XE7
  {$UNDEF OLD_SOCKETS}
{$IFEND}


// EOF


