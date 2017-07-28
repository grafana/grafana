package kodo

import (
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"testing"
	"time"
)

var (
	key        = "aa"
	keyFetch   = "afetch"
	newkey1    = "bbbb"
	newkey2    = "cccc"
	fetchURL   = "http://www-static.u.qiniucdn.com/public/v1645/img/css-sprite.png"
	bucketName string
	domain     string
	client     *Client
	bucket     = newBucket()

	QINIU_KODO_TEST string
)

func init() {

	if skipTest() {
		return
	}
	rand.Seed(time.Now().UnixNano())
	key += strconv.Itoa(rand.Int())
	keyFetch += strconv.Itoa(rand.Int())
	newkey1 += strconv.Itoa(rand.Int())
	newkey2 += strconv.Itoa(rand.Int())
	bucket.BatchDelete(nil, key, keyFetch, newkey1, newkey2)
}

func newBucket() (bucket Bucket) {

	QINIU_KODO_TEST = os.Getenv("QINIU_KODO_TEST")
	if skipTest() {
		println("[INFO] QINIU_KODO_TEST: skipping to test github.com/qiniu/api.v7")
		return
	}

	ak := os.Getenv("QINIU_ACCESS_KEY")
	sk := os.Getenv("QINIU_SECRET_KEY")
	if ak == "" || sk == "" {
		panic("require ACCESS_KEY & SECRET_KEY")
	}
	SetMac(ak, sk)

	bucketName = os.Getenv("QINIU_TEST_BUCKET")
	domain = os.Getenv("QINIU_TEST_DOMAIN")
	if bucketName == "" || domain == "" {
		panic("require test env")
	}
	client = NewWithoutZone(nil)

	return client.Bucket(bucketName)
}

func skipTest() bool {

	return QINIU_KODO_TEST == ""
}

func upFile(localFile, key string) error {

	return bucket.PutFile(nil, nil, key, localFile, nil)
}

func TestFetch(t *testing.T) {

	if skipTest() {
		return
	}

	err := bucket.Fetch(nil, keyFetch, fetchURL)
	if err != nil {
		t.Fatal("bucket.Fetch failed:", err)
	}

	entry, err := bucket.Stat(nil, keyFetch)
	if err != nil || entry.MimeType != "image/png" {
		t.Fatal("bucket.Fetch: Stat failed -", err, "entry:", entry)
	}
	fmt.Println(entry)
}

func TestEntry(t *testing.T) {

	if skipTest() {
		return
	}

	//上传一个文件用用于测试
	err := upFile("doc.go", key)
	if err != nil {
		t.Fatal(err)
	}
	defer bucket.Delete(nil, key)

	einfo, err := bucket.Stat(nil, key)
	if err != nil {
		t.Fatal(err)
	}

	mime := "text/plain"
	err = bucket.ChangeMime(nil, key, mime)
	if err != nil {
		t.Fatal(err)
	}

	einfo, err = bucket.Stat(nil, key)
	if err != nil {
		t.Fatal(err)
	}
	if einfo.MimeType != mime {
		t.Fatal("mime type did not change")
	}

	err = bucket.Copy(nil, key, newkey1)
	if err != nil {
		t.Fatal(err)
	}
	enewinfo, err := bucket.Stat(nil, newkey1)
	if err != nil {
		t.Fatal(err)
	}
	if einfo.Hash != enewinfo.Hash {
		t.Fatal("invalid entryinfo:", einfo, enewinfo)
	}
	err = bucket.Move(nil, newkey1, newkey2)
	if err != nil {
		t.Fatal(err)
	}
	enewinfo2, err := bucket.Stat(nil, newkey2)
	if err != nil {
		t.Fatal(err)
	}
	if enewinfo.Hash != enewinfo2.Hash {
		t.Fatal("invalid entryinfo:", enewinfo, enewinfo2)
	}

	err = bucket.Delete(nil, newkey2)
	if err != nil {
		t.Fatal(err)
	}
}
