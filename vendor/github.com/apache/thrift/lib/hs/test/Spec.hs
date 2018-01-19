--
-- Licensed to the Apache Software Foundation (ASF) under one
-- or more contributor license agreements. See the NOTICE file
-- distributed with this work for additional information
-- regarding copyright ownership. The ASF licenses this file
-- to you under the Apache License, Version 2.0 (the
-- "License"); you may not use this file except in compliance
-- with the License. You may obtain a copy of the License at
--
--   http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing,
-- software distributed under the License is distributed on an
-- "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
-- KIND, either express or implied. See the License for the
-- specific language governing permissions and limitations
-- under the License.
--

-- Our CI does not work well with auto discover.
-- Need to add build-time PATH variable to hspec-discover dir from CMake
-- or install hspec system-wide for the following to work.
-- {-# OPTIONS_GHC -F -pgmF hspec-discover #-}

import Test.Hspec

import qualified BinarySpec
import qualified CompactSpec
import qualified JSONSpec

main :: IO ()
main = hspec spec

spec :: Spec
spec = do
  describe "Binary" BinarySpec.spec
  describe "Compact" CompactSpec.spec
  describe "JSON" JSONSpec.spec
