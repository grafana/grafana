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

module Thrift.Transport.IOBuffer
       ( WriteBuffer
       , newWriteBuffer
       , writeBuf
       , flushBuf
       , ReadBuffer
       , newReadBuffer
       , fillBuf
       , readBuf
       , peekBuf
       ) where

import Data.ByteString.Lazy.Builder
import Data.Functor
import Data.IORef
import Data.Monoid
import Data.Word

import qualified Data.ByteString.Lazy as LBS

type WriteBuffer = IORef Builder
type ReadBuffer = IORef LBS.ByteString

newWriteBuffer :: IO WriteBuffer
newWriteBuffer = newIORef mempty

writeBuf :: WriteBuffer -> LBS.ByteString -> IO ()
writeBuf w s = modifyIORef w ( <> lazyByteString s)

flushBuf :: WriteBuffer -> IO LBS.ByteString
flushBuf w = do
  buf <- readIORef w
  writeIORef w mempty
  return $ toLazyByteString buf

newReadBuffer :: IO ReadBuffer
newReadBuffer = newIORef mempty

fillBuf :: ReadBuffer -> LBS.ByteString -> IO ()
fillBuf = writeIORef

readBuf :: ReadBuffer -> Int -> IO LBS.ByteString
readBuf r n = do
  bs <- readIORef r
  let (hd, tl) = LBS.splitAt (fromIntegral n) bs
  writeIORef r tl
  return hd

peekBuf :: ReadBuffer -> IO (Maybe Word8)
peekBuf r = (fmap fst . LBS.uncons) <$> readIORef r
