package org.apache.thrift.protocol;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.apache.thrift.Fixtures;
import org.apache.thrift.TException;
import org.apache.thrift.transport.TMemoryBuffer;

public class BenchmarkProtocols {

  private static final Set<TProtocolFactory> FACTORIES = new LinkedHashSet<TProtocolFactory>(){{
    add(new TTupleProtocol.Factory());
    add(new TCompactProtocol.Factory());
    add(new TBinaryProtocol.Factory());
  }};

  private static final int NUM_REPS = 100000;
  private static final int NUM_TRIALS = 10;

  public static void main(String[] args) throws TException {
    Map<TProtocolFactory, List<Long>> timesByFactory = new HashMap<TProtocolFactory, List<Long>>();

    for (int trial = 0; trial < NUM_TRIALS; trial++) {
      for (int i = 0; i < 16; i++) {
        System.gc();
      }
//      TProtocol proto = factory.getProtocol(new TTransport() {
//        @Override
//        public void write(byte[] buf, int off, int len) throws TTransportException {
//        }
//
//        @Override
//        public int read(byte[] buf, int off, int len) throws TTransportException {
//          return 0;
//        }
//
//        @Override
//        public void open() throws TTransportException {
//        }
//
//        @Override
//        public boolean isOpen() {
//          return true;
//        }
//
//        @Override
//        public void close() {
//        }
//      });


      for (TProtocolFactory factory : FACTORIES) {
        if (timesByFactory.get(factory) == null) {
          timesByFactory.put(factory, new ArrayList<Long>());
        }

        long start = System.currentTimeMillis();
        for (int rep = 0; rep < NUM_REPS; rep++) {
          TProtocol proto = factory.getProtocol(new TMemoryBuffer(128*1024));
          Fixtures.compactProtoTestStruct.write(proto);
          Fixtures.nesting.write(proto);
        }
        long end = System.currentTimeMillis();
        timesByFactory.get(factory).add(end-start);
      }
    }

    for (TProtocolFactory factory : FACTORIES) {
      List<Long> times = timesByFactory.get(factory);
//      System.out.println("raw times pre-drop: " + times );
      times.remove(Collections.max(times));
      long total = 0;
      for (long t : times) {
        total += t;
      }
      Collections.sort(times);
      System.out.println(factory.getClass().getName() + " average time: " + (total / times.size()) + "ms");
      System.out.println("raw times: " + times);
    }
  }

}
