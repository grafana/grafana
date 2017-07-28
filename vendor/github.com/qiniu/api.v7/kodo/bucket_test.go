package kodo

import (
	"context"
	"math/rand"
	"strconv"
	"testing"
	"time"
)

var (
	batchTestKey     = "abatch"
	batchTestNewKey1 = "abatch/newkey1"
	batchTestNewKey2 = "abatch/newkey2"
)

func init() {

	if skipTest() {
		return
	}

	rand.Seed(time.Now().UnixNano())
	batchTestKey += strconv.Itoa(rand.Int())
	batchTestNewKey1 += strconv.Itoa(rand.Int())
	batchTestNewKey2 += strconv.Itoa(rand.Int())
	// 删除 可能存在的 key
	bucket.BatchDelete(nil, batchTestKey, batchTestNewKey1, batchTestNewKey2)
}

func TestAll(t *testing.T) {

	if skipTest() {
		return
	}

	//上传一个文件用用于测试
	err := upFile("bucket_test.go", batchTestKey)
	if err != nil {
		t.Fatal(err)
	}
	defer bucket.Delete(nil, batchTestKey)

	testBatchStat(t)
	testBatchCopy(t)
	testBatchMove(t)
	testBatchDelete(t)
	testBatch(t)
	testClient_MakeUptokenBucket(t)
	testDeleteAfterDays(t)
}

func testBatchStat(t *testing.T) {

	rets, err := bucket.BatchStat(nil, batchTestKey, batchTestKey, batchTestKey)
	if err != nil {
		t.Fatal("bucket.BatchStat failed:", err)
	}

	if len(rets) != 3 {
		t.Fatal("BatchStat failed: len(rets) = ", 3)
	}

	stat, err := bucket.Stat(nil, batchTestKey)
	if err != nil {
		t.Fatal("bucket.Stat failed:", err)
	}

	if rets[0].Data != stat || rets[1].Data != stat || rets[2].Data != stat {
		t.Fatal("BatchStat failed : returns err")
	}
}

func testBatchMove(t *testing.T) {

	stat0, err := bucket.Stat(nil, batchTestKey)
	if err != nil {
		t.Fatal("BathMove get stat failed:", err)
	}

	_, err = bucket.BatchMove(nil, KeyPair{batchTestKey, batchTestNewKey1}, KeyPair{batchTestNewKey1, batchTestNewKey2})
	if err != nil {
		t.Fatal("bucket.BatchMove failed:", err)
	}
	defer bucket.Move(nil, batchTestNewKey2, batchTestKey)

	stat1, err := bucket.Stat(nil, batchTestNewKey2)
	if err != nil {
		t.Fatal("BathMove get stat failed:", err)
	}

	if stat0.Hash != stat1.Hash {
		t.Fatal("BatchMove failed : Move err", stat0, stat1)
	}
}

func testBatchCopy(t *testing.T) {

	_, err := bucket.BatchCopy(nil, KeyPair{batchTestKey, batchTestNewKey1}, KeyPair{batchTestKey, batchTestNewKey2})
	if err != nil {
		t.Fatal(err)
	}
	defer bucket.Delete(nil, batchTestNewKey1)
	defer bucket.Delete(nil, batchTestNewKey2)

	stat0, _ := bucket.Stat(nil, batchTestKey)
	stat1, _ := bucket.Stat(nil, batchTestNewKey1)
	stat2, _ := bucket.Stat(nil, batchTestNewKey2)
	if stat0.Hash != stat1.Hash || stat0.Hash != stat2.Hash {
		t.Fatal("BatchCopy failed : Copy err")
	}
}

func testBatchDelete(t *testing.T) {

	bucket.Copy(nil, batchTestKey, batchTestNewKey1)
	bucket.Copy(nil, batchTestKey, batchTestNewKey2)

	_, err := bucket.BatchDelete(nil, batchTestNewKey1, batchTestNewKey2)
	if err != nil {
		t.Fatal(err)
	}

	_, err1 := bucket.Stat(nil, batchTestNewKey1)
	_, err2 := bucket.Stat(nil, batchTestNewKey2)

	//这里 err1 != nil，否则文件没被成功删除
	if err1 == nil || err2 == nil {
		t.Fatal("BatchDelete failed : File do not delete")
	}
}

func testBatch(t *testing.T) {

	ops := []string{
		URICopy(bucketName, batchTestKey, bucketName, batchTestNewKey1),
		URIDelete(bucketName, batchTestKey),
		URIMove(bucketName, batchTestNewKey1, bucketName, batchTestKey),
	}

	var rets []BatchItemRet
	err := client.Batch(nil, &rets, ops)
	if err != nil {
		t.Fatal(err)
	}
	if len(rets) != 3 {
		t.Fatal("len(rets) != 3")
	}
}

func testDeleteAfterDays(t *testing.T) {

	ctx := context.Background()

	err := bucket.DeleteAfterDays(ctx, batchTestNewKey1, 5)
	if err == nil {
		t.Fatal("Expect an error")
	}

	bucket.Copy(ctx, batchTestKey, batchTestNewKey1)

	err = bucket.DeleteAfterDays(ctx, batchTestNewKey1, 5)
	if err != nil {
		t.Fatal(err)
	}

}
