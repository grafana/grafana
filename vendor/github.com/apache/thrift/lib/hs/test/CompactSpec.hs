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

module CompactSpec where

import Test.Hspec
import Test.Hspec.QuickCheck (prop)

import qualified Data.ByteString.Lazy as LBS

import Thrift.Types
import Thrift.Transport
import Thrift.Transport.Memory
import Thrift.Protocol
import Thrift.Protocol.Compact

spec :: Spec
spec = do
  describe "CompactProtocol" $ do
    describe "double" $ do
      it "writes in little endian order" $ do
        let val = 2 ** 53
        trans <- openMemoryBuffer
        let proto = CompactProtocol trans
        writeVal proto (TDouble val)
        bin <- tReadAll trans 8
        (LBS.unpack bin) `shouldBe`[0, 0, 0, 0, 0, 0, 64, 67]

      it "reads in little endian order" $ do
        let bin = LBS.pack [0, 0, 0, 0, 0, 0, 64, 67]
        trans <- openMemoryBuffer
        let proto = CompactProtocol trans
        tWrite trans bin
        val <- readVal proto T_DOUBLE
        val `shouldBe` (TDouble $ 2 ** 53)

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = CompactProtocol trans
        writeVal proto $ TDouble val
        val2 <- readVal proto T_DOUBLE
        val2 `shouldBe` (TDouble val)

    describe "binary" $ do
      it "writes" $ do
        trans <- openMemoryBuffer
        let proto = CompactProtocol trans
        writeVal proto (TBinary $ LBS.pack [42, 43, 44])
        bin <- tRead trans 100
        (LBS.unpack bin) `shouldBe` [3, 42, 43, 44]

      it "reads" $ do
        trans <- openMemoryBuffer
        let proto = CompactProtocol trans
        tWrite trans $ LBS.pack [3, 42, 43, 44]
        val <- readVal proto (T_BINARY)
        val `shouldBe` (TBinary $ LBS.pack [42, 43, 44])

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = CompactProtocol trans
        writeVal proto (TBinary $ LBS.pack val)
        val2 <- readVal proto (T_BINARY)
        val2 `shouldBe` (TBinary $ LBS.pack val)

