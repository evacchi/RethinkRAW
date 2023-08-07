package dcraw

import (
	expsys "github.com/tetratelabs/wazero/experimental/sys"
	"os"
	"strings"
	"testing"
	"testing/fstest"
)

func Test_readerFS(t *testing.T) {
	fs := readerFS{strings.NewReader("contents")}
	if err := fstest.TestFS(fs, readerFSname); err != nil {
		t.Fatal(err)
	}
}

func Test_singletonFS(t *testing.T) {
	dir := t.TempDir()
	fname := dir + "/test"
	_ = os.WriteFile(fname, []byte("TEST"), 0o0777)
	f, _ := os.Open(fname)
	fs := singletonFS{f: f}
	file, errno := fs.OpenFile(readerFSname, expsys.O_RDONLY, 0)
	if errno != 0 {
		t.Fail()
	}
	buf := make([]byte, 4)
	_, errno = file.Read(buf)
	if errno != 0 {
		t.Fail()
	}
	if "TEST" != string(buf) {
		t.Fail()
	}
}
