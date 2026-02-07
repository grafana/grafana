// Package jsonmerge helps mergeing JSON objects
//
// For example you have this documents:
//
// original.json
//  {
//    "number": 1,
//    "string": "value",
//    "object": {
//      "number": 1,
//        "string": "value",
//        "nested object": {
//          "number": 2
//        },
//        "array": [1, 2, 3],
//        "partial_array": [1, 2, 3]
//     }
//  }
//
// patch.json
//  {
//    "number": 2,
//    "string": "value1",
//    "nonexitent": "woot",
//    "object": {
//      "number": 3,
//      "string": "value2",
//      "nested object": {
//        "number": 4
//      },
//      "array": [3, 2, 1],
//      "partial_array": {
//        "1": 4
//      }
//    }
//  }
//
// After merge you will have this result:
//  {
//    "number": 2,
//    "string": "value1",
//    "object": {
//      "number": 3,
//      "string": "value2",
//      "nested object": {
//        "number": 4
//      },
//      "array": [3, 2, 1],
//      "partial_array": [1, 4, 3]
//    }
//  }
package jsonmerge
