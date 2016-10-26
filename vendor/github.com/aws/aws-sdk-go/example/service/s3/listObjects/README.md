# Example

listObjects is an example using the AWS SDK for Go to list objects' key in a S3 bucket.


# Usage

The example uses the the bucket name provided, and lists all object keys in a bucket.

```sh
go run listObjects.go <bucket>
```

Output:
```
Page, 0
Object: myKey
Object: mykey.txt
Object: resources/0001/item-01
Object: resources/0001/item-02
Object: resources/0001/item-03
Object: resources/0002/item-01
Object: resources/0002/item-02
Object: resources/0002/item-03
Object: resources/0002/item-04
Object: resources/0002/item-05
```
