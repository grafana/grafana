function serialize(data) {
  var transport = new Thrift.Transport("/service");
  var protocol  = new Thrift.Protocol(transport);
  protocol.writeMessageBegin("", 0, 0);
  data.write(protocol);
  protocol.writeMessageEnd();
  return transport.send_buf;
}

function deserialize(serialized, type) {
  var transport = new Thrift.Transport("/service");
  transport.setRecvBuffer(serialized);
  var protocol  = new Thrift.Protocol(transport);
  protocol.readMessageBegin();
  var data = new type();
  data.read(protocol);
  protocol.readMessageEnd();
  return data;
}


function createThriftObj() {

  return new Complex({

    struct_field: new Simple({value: 'a'}),

    struct_list_field: [
      new Simple({value: 'b'}),
      new Simple({value: 'c'}),
    ],

    struct_set_field: [
      new Simple({value: 'd'}),
      new Simple({value: 'e'}),
    ],

    struct_map_field: {
      A: new Simple({value: 'f'}),
      B: new Simple({value: 'g'})
    },

    struct_nested_containers_field: [
      [
        {
          C: [
            new Simple({value: 'h'}),
            new Simple({value: 'i'})
          ]
        }
      ]
    ],


    struct_nested_containers_field2: {
      D: [
        {
          DA: new Simple({value: 'j'})
        },
        {
          DB: new Simple({value: 'k'})
        }
      ]
    }
  }
  );
}


function createJsObj() {

  return {

    struct_field: {value: 'a'},

    struct_list_field: [
      {value: 'b'},
      {value: 'c'},
    ],

    struct_set_field: [
      {value: 'd'},
      {value: 'e'},
    ],

    struct_map_field: {
      A: {value: 'f'},
      B: {value: 'g'}
    },

    struct_nested_containers_field: [
      [
        {
          C: [
            {value: 'h'},
            {value: 'i'}
          ]
        }
      ]
    ],

    struct_nested_containers_field2: {
      D: [
        {
          DA: {value: 'j'}
        },
        {
          DB: {value: 'k'}
        }
      ]
    }
  };
}


function assertValues(obj, assert) {
    assert.equal(obj.struct_field.value, 'a');
    assert.equal(obj.struct_list_field[0].value, 'b');
    assert.equal(obj.struct_list_field[1].value, 'c');
    assert.equal(obj.struct_set_field[0].value, 'd');
    assert.equal(obj.struct_set_field[1].value, 'e');
    assert.equal(obj.struct_map_field.A.value, 'f');
    assert.equal(obj.struct_map_field.B.value, 'g');
    assert.equal(obj.struct_nested_containers_field[0][0].C[0].value, 'h');
    assert.equal(obj.struct_nested_containers_field[0][0].C[1].value, 'i');
    assert.equal(obj.struct_nested_containers_field2.D[0].DA.value, 'j');
    assert.equal(obj.struct_nested_containers_field2.D[1].DB.value, 'k');
}

var cases = {

  "Serialize/deserialize simple struct should return equal object": function(assert){
    var tObj = new Simple({value: 'a'});
    var received = deserialize(serialize(tObj), Simple);
    assert.ok(tObj !== received);
    assert.deepEqual(received, tObj);
  },


  "Serialize/deserialize should return equal object": function(assert){
    var tObj = createThriftObj();
    var received = deserialize(serialize(tObj), Complex);
    assert.ok(tObj !== received);
    assert.deepEqual(received, tObj);
  },

  "Nested structs and containers initialized from plain js objects should serialize same as if initialized from thrift objects": function(assert) {
    var tObj1 = createThriftObj();
    var tObj2 = new Complex(createJsObj());
    assertValues(tObj2, assert);
    assert.equal(serialize(tObj2), serialize(tObj1));
  },

  "Modifications to args object should not affect constructed Thrift object": function (assert) {

    var args = createJsObj();
    assertValues(args, assert);

    var tObj = new Complex(args);
    assertValues(tObj, assert);

    args.struct_field.value = 'ZZZ';
    args.struct_list_field[0].value = 'ZZZ';
    args.struct_list_field[1].value = 'ZZZ';
    args.struct_set_field[0].value = 'ZZZ';
    args.struct_set_field[1].value = 'ZZZ';
    args.struct_map_field.A.value = 'ZZZ';
    args.struct_map_field.B.value = 'ZZZ';
    args.struct_nested_containers_field[0][0].C[0] = 'ZZZ';
    args.struct_nested_containers_field[0][0].C[1] = 'ZZZ';
    args.struct_nested_containers_field2.D[0].DA = 'ZZZ';
    args.struct_nested_containers_field2.D[0].DB = 'ZZZ';

    assertValues(tObj, assert);
  },

  "nulls are ok": function(assert) {
    var tObj = new Complex({
      struct_field: null,
      struct_list_field: null,
      struct_set_field: null,
      struct_map_field: null,
      struct_nested_containers_field: null,
      struct_nested_containers_field2: null
    });
    var received = deserialize(serialize(tObj), Complex);
    assert.ok(tObj !== received);
    assert.deepEqual(tObj, received);
  }

};

Object.keys(cases).forEach(function(caseName) {
  test(caseName, cases[caseName]);
});
