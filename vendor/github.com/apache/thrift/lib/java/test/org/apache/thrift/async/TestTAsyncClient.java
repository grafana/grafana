package org.apache.thrift.async;

import junit.framework.TestCase;

import org.apache.thrift.TException;

import thrift.test.Srv;
import thrift.test.Srv.AsyncClient;

public class TestTAsyncClient extends TestCase {
  public void testRaisesExceptionWhenUsedConcurrently() throws Exception {
    TAsyncClientManager mockClientManager = new TAsyncClientManager() {
      @Override
      public void call(TAsyncMethodCall method) throws TException {
        // do nothing
      }
    };

    Srv.AsyncClient c = new AsyncClient(null, mockClientManager, null);
    c.Janky(0, null);
    try {
      c.checkReady();
      fail("should have hit an exception");
    } catch (Exception e) {
      // awesome
    }
  }
}
