package org.apache.thrift.protocol;

import org.apache.thrift.TDeserializer;
import org.apache.thrift.TSerializer;

import thrift.test.TupleProtocolTestStruct;


public class TestTTupleProtocol extends ProtocolTestBase {

  @Override
  protected boolean canBeUsedNaked() {
    return false;
  }

  @Override
  protected TProtocolFactory getFactory() {
    return new TTupleProtocol.Factory();
  }

  public void testBitsetLengthIssue() throws Exception {
    final TupleProtocolTestStruct t1 = new TupleProtocolTestStruct();
    t1.setField1(0);
    t1.setField2(12);
    new TDeserializer(new TTupleProtocol.Factory()).deserialize(new TupleProtocolTestStruct(), new TSerializer(new TTupleProtocol.Factory()).serialize(t1));
  }
}
