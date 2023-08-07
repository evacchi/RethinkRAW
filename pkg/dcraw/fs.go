package dcraw

import (
	expsys "github.com/tetratelabs/wazero/experimental/sys"
	"github.com/tetratelabs/wazero/sys"
	"io"
	"io/fs"
	"os"
	"time"
)

type singletonFS struct {
	expsys.UnimplementedFS
	f *os.File
}

func (f *singletonFS) OpenFile(name string, flag expsys.Oflag, perm fs.FileMode) (expsys.File, expsys.Errno) {
	if name == "." {
		return &singletonDir{f: f.f}, 0
	}
	if name == readerFSname {
		_, err := f.f.Seek(0, io.SeekStart)
		if err != nil {
			return nil, expsys.UnwrapOSError(err)
		}
		return &singletonFile{f: f.f}, 0
	}
	return nil, expsys.EINVAL
}

type singletonDir struct {
	expsys.UnimplementedFile
	f *os.File
}

func (d *singletonDir) IsDir() (bool, expsys.Errno) {
	return true, 0
}

func (d singletonDir) Stat() (sys.Stat_t, expsys.Errno) {
	stat, _ := d.f.Stat()
	return sys.NewStat_t(stat), 0
}

type singletonFile struct {
	expsys.UnimplementedFile
	f *os.File
}

func (f *singletonFile) Stat() (sys.Stat_t, expsys.Errno) {
	t, err := f.f.Stat()
	if err != nil {
		return sys.Stat_t{}, expsys.UnwrapOSError(err)
	}
	return sys.NewStat_t(t), 0
}

func (f *singletonFile) Read(buf []byte) (n int, errno expsys.Errno) {
	n, err := f.f.Read(buf)
	if err != nil {
		return -1, expsys.UnwrapOSError(err)
	}
	return n, 0
}

func (f *singletonFile) Seek(offset int64, whence int) (newOffset int64, errno expsys.Errno) {
	n, err := f.f.Seek(offset, whence)
	if err != nil {
		return -1, expsys.UnwrapOSError(err)
	}
	return n, 0

}

// These implement an [fs.FS] with a single root directory,
// and a single file in that directory, named [readerFSname],
// that reads from the [io.ReadSeeker].

type readerFS struct{ r io.ReadSeeker }
type readerDir struct{ r io.ReadSeeker }
type readerFile struct{ io.ReadSeeker }

const readerFSname = "input"

func (f readerFS) Open(name string) (fs.File, error) {
	if name == "." {
		return &readerDir{f.r}, nil
	}
	if name == readerFSname {
		_, err := f.r.Seek(0, io.SeekStart)
		if err != nil {
			return nil, err
		}
		return readerFile{f.r}, nil
	}
	if fs.ValidPath(name) {
		return nil, fs.ErrNotExist
	}
	return nil, fs.ErrInvalid
}

func (f readerFile) Close() error { return nil }

func (f readerFile) Stat() (fs.FileInfo, error) { return f, nil }

func (f readerFile) Size() int64 {
	current, err := f.Seek(0, io.SeekCurrent)
	if err != nil {
		return 0
	}
	end, _ := f.Seek(0, io.SeekEnd)
	f.Seek(current, io.SeekStart)
	return end
}

func (f readerFile) IsDir() bool { return false }

func (f readerFile) ModTime() time.Time { return time.Time{} }

func (f readerFile) Mode() fs.FileMode { return 0400 }

func (f readerFile) Name() string { return readerFSname }

func (f readerFile) Sys() any { return nil }

func (f readerFile) Info() (fs.FileInfo, error) { return f, nil }

func (f readerFile) Type() fs.FileMode { return f.Mode().Type() }

func (d *readerDir) Close() error {
	d.r = nil
	return nil
}

func (d *readerDir) ReadDir(n int) (entries []fs.DirEntry, err error) {
	switch {
	case d.r != nil:
		entries = []fs.DirEntry{readerFile{d.r}}
		d.r = nil
	case n > 0:
		err = io.EOF
	}
	return
}

func (d *readerDir) Read([]byte) (int, error) { return 0, nil }

func (d *readerDir) Stat() (fs.FileInfo, error) { return d, nil }

func (d *readerDir) IsDir() bool { return true }

func (d *readerDir) ModTime() time.Time { return time.Time{} }

func (d *readerDir) Mode() fs.FileMode { return fs.ModeDir | 0700 }

func (d *readerDir) Name() string { return "." }

func (d *readerDir) Size() int64 { return 0 }

func (d *readerDir) Sys() any { return nil }
