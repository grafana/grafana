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

module JSONSpec where

import Test.Hspec
import Test.Hspec.QuickCheck (prop)

import qualified Data.ByteString.Lazy as LBS
import qualified Data.ByteString.Lazy.Char8 as C

import Thrift.Types
import Thrift.Transport
import Thrift.Transport.Memory
import Thrift.Protocol
import Thrift.Protocol.JSON

tString :: [Char] -> ThriftVal
tString = TString . C.pack

spec :: Spec
spec = do
  describe "JSONProtocol" $ do
    describe "bool" $ do
      it "writes true as 1" $ do
        let val = True
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TBool val)
        bin <-tRead trans 100
        (C.unpack bin) `shouldBe` ['1']

      it "writes false as 0" $ do
        let val = False
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TBool val)
        bin <- tRead trans 100
        (C.unpack bin) `shouldBe` ['0']

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto $ TBool val
        val2 <- readVal proto T_BOOL
        val2 `shouldBe` (TBool val)

    describe "string" $ do
      it "writes" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TString $ C.pack "\"a")
        bin <- tRead trans 100
        (C.unpack bin) `shouldBe` "\"\\\"a\""

      it "reads" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans $ C.pack "\"\\\"a\""
        val <- readVal proto (T_STRING)
        val `shouldBe` (TString $ C.pack "\"a")

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TString $ C.pack val)
        val2 <- readVal proto (T_STRING)
        val2 `shouldBe` (TString $ C.pack val)

    describe "binary" $ do
      it "writes with padding" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TBinary $ LBS.pack [1])
        bin <- tRead trans 100
        (C.unpack bin) `shouldBe` "\"AQ==\""

      it "reads with padding" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans $ C.pack "\"AQ==\""
        val <- readVal proto (T_BINARY)
        val `shouldBe` (TBinary $ LBS.pack [1])

      it "reads without padding" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans $ C.pack "\"AQ\""
        val <- readVal proto (T_BINARY)
        val `shouldBe` (TBinary $ LBS.pack [1])

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TBinary $ LBS.pack val)
        val2 <- readVal proto (T_BINARY)
        val2 `shouldBe` (TBinary $ LBS.pack val)

    describe "list" $ do
      it "writes empty list" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TList T_BYTE [])
        bin <- tRead trans 100
        (C.unpack bin) `shouldBe` "[\"i8\",0]"

      it "reads empty" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack "[\"i8\",0]")
        val <- readVal proto (T_LIST T_BYTE)
        val `shouldBe` (TList T_BYTE [])

      it "writes single element" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TList T_BYTE [TByte 0])
        bin <- tRead trans 100
        (C.unpack bin) `shouldBe` "[\"i8\",1,0]"

      it "reads single element" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack "[\"i8\",1,0]")
        val <- readVal proto (T_LIST T_BYTE)
        val `shouldBe` (TList T_BYTE [TByte 0])

      it "reads elements" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack "[\"i8\",2,42, 43]")
        val <- readVal proto (T_LIST T_BYTE)
        val `shouldBe` (TList T_BYTE [TByte 42, TByte 43])

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto $ (TList T_STRING $ map tString val)
        val2 <- readVal proto $ T_LIST T_STRING
        val2 `shouldBe` (TList T_STRING $ map tString val)

    describe "set" $ do
      it "writes empty" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TSet T_BYTE [])
        bin <- tRead trans 100
        (C.unpack bin) `shouldBe` "[\"i8\",0]"

      it "reads empty" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack "[\"i8\",0]")
        val <- readVal proto (T_SET T_BYTE)
        val `shouldBe` (TSet T_BYTE [])

      it "reads single element" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack "[\"i8\",1,0]")
        val <- readVal proto (T_SET T_BYTE)
        val `shouldBe` (TSet T_BYTE [TByte 0])

      it "reads elements" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack "[\"i8\",2,42, 43]")
        val <- readVal proto (T_SET T_BYTE)
        val `shouldBe` (TSet T_BYTE [TByte 42, TByte 43])

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto $ (TSet T_STRING $ map tString val)
        val2 <- readVal proto $ T_SET T_STRING
        val2 `shouldBe` (TSet T_STRING $ map tString val)

    describe "map" $ do
      it "writes empty" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto (TMap T_BYTE T_BYTE [])
        bin <- tRead trans 100
        (C.unpack bin) `shouldBe`"[\"i8\",\"i8\",0,{}]"

      it "reads empty" $ do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack "[\"i8\",\"i8\",0,{}]")
        val <- readVal proto (T_MAP T_BYTE T_BYTE)
        val `shouldBe` (TMap T_BYTE T_BYTE [])

      it "reads string-string" $ do
        let bin = "[\"str\",\"str\",2,{\"a\":\"2\",\"b\":\"blah\"}]"
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        tWrite trans (C.pack bin)
        val <- readVal proto (T_MAP T_STRING T_STRING)
        val`shouldBe` (TMap T_STRING T_STRING [(tString "a", tString "2"), (tString "b", tString "blah")])

      prop "round trip" $ \val -> do
        trans <- openMemoryBuffer
        let proto = JSONProtocol trans
        writeVal proto $ (TMap T_STRING T_STRING $ map toKV val)
        val2 <- readVal proto $ T_MAP T_STRING T_STRING
        val2 `shouldBe` (TMap T_STRING T_STRING $ map toKV val)
        where
          toKV v = (tString v, tString v)

