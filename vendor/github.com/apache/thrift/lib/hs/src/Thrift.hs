{-# LANGUAGE DeriveDataTypeable #-}
{-# LANGUAGE OverloadedStrings #-}
{-# LANGUAGE RankNTypes #-}
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

module Thrift
    ( module Thrift.Transport
    , module Thrift.Protocol
    , AppExnType(..)
    , AppExn(..)
    , readAppExn
    , writeAppExn
    , ThriftException(..)
    ) where

import Control.Exception

import Data.Int
import Data.Text.Lazy ( Text, pack, unpack )
import Data.Text.Lazy.Encoding
import Data.Typeable ( Typeable )
import qualified Data.HashMap.Strict as Map

import Thrift.Protocol
import Thrift.Transport
import Thrift.Types

data ThriftException = ThriftException
  deriving ( Show, Typeable )
instance Exception ThriftException

data AppExnType
    = AE_UNKNOWN
    | AE_UNKNOWN_METHOD
    | AE_INVALID_MESSAGE_TYPE
    | AE_WRONG_METHOD_NAME
    | AE_BAD_SEQUENCE_ID
    | AE_MISSING_RESULT
    | AE_INTERNAL_ERROR
    | AE_PROTOCOL_ERROR
    | AE_INVALID_TRANSFORM
    | AE_INVALID_PROTOCOL
    | AE_UNSUPPORTED_CLIENT_TYPE
      deriving ( Eq, Show, Typeable )

instance Enum AppExnType where
    toEnum 0 = AE_UNKNOWN
    toEnum 1 = AE_UNKNOWN_METHOD
    toEnum 2 = AE_INVALID_MESSAGE_TYPE
    toEnum 3 = AE_WRONG_METHOD_NAME
    toEnum 4 = AE_BAD_SEQUENCE_ID
    toEnum 5 = AE_MISSING_RESULT
    toEnum 6 = AE_INTERNAL_ERROR
    toEnum 7 = AE_PROTOCOL_ERROR
    toEnum 8 = AE_INVALID_TRANSFORM
    toEnum 9 = AE_INVALID_PROTOCOL
    toEnum 10 = AE_UNSUPPORTED_CLIENT_TYPE
    toEnum t = error $ "Invalid AppExnType " ++ show t

    fromEnum AE_UNKNOWN = 0
    fromEnum AE_UNKNOWN_METHOD = 1
    fromEnum AE_INVALID_MESSAGE_TYPE = 2
    fromEnum AE_WRONG_METHOD_NAME = 3
    fromEnum AE_BAD_SEQUENCE_ID = 4
    fromEnum AE_MISSING_RESULT = 5
    fromEnum AE_INTERNAL_ERROR = 6
    fromEnum AE_PROTOCOL_ERROR = 7
    fromEnum AE_INVALID_TRANSFORM = 8
    fromEnum AE_INVALID_PROTOCOL = 9
    fromEnum AE_UNSUPPORTED_CLIENT_TYPE = 10

data AppExn = AppExn { ae_type :: AppExnType, ae_message :: String }
  deriving ( Show, Typeable )
instance Exception AppExn

writeAppExn :: (Protocol p, Transport t) => p t -> AppExn -> IO ()
writeAppExn pt ae = writeVal pt $ TStruct $ Map.fromList
                    [ (1, ("message", TString $ encodeUtf8 $ pack $ ae_message ae))
                    , (2, ("type", TI32 $ fromIntegral $ fromEnum (ae_type ae)))
                    ]

readAppExn :: (Protocol p, Transport t) => p t -> IO AppExn
readAppExn pt = do
    let typemap = Map.fromList [(1,("message",T_STRING)),(2,("type",T_I32))]
    TStruct fields <- readVal pt $ T_STRUCT typemap
    return $ readAppExnFields fields

readAppExnFields :: Map.HashMap Int16 (Text, ThriftVal) -> AppExn
readAppExnFields fields = AppExn{
  ae_message = maybe undefined unwrapMessage $ Map.lookup 1 fields,
  ae_type    = maybe undefined unwrapType $ Map.lookup 2 fields
  }
  where
    unwrapMessage (_, TString s) = unpack $ decodeUtf8 s
    unwrapMessage _ = undefined
    unwrapType (_, TI32 i) = toEnum $ fromIntegral i
    unwrapType _ = undefined
