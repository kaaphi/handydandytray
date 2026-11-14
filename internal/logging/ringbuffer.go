package logging

import (
	"bytes"
	"os"
	"sync"
)

// RingBuffer is a thread-safe, fixed-capacity circular io.Writer designed for log output.
type RingBuffer struct {
	mu   sync.Mutex
	buf  []byte
	pos  int
	full bool
}

func NewRingBuffer(capacityBytes int) *RingBuffer {
	return &RingBuffer{
		buf: make([]byte, capacityBytes),
	}
}

func (b *RingBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()

	n := len(p)
	cap := len(b.buf)

	if n >= cap {
		copy(b.buf, p[n-cap:])
		b.pos = 0
		b.full = true
		return n, nil
	}

	rem := cap - b.pos
	if n <= rem {
		copy(b.buf[b.pos:], p)
		b.pos += n
		if b.pos == cap {
			b.pos = 0
			b.full = true
		}
	} else {
		copy(b.buf[b.pos:], p[:rem])
		copy(b.buf[0:], p[rem:])
		b.pos = n - rem
		b.full = true
	}

	return n, nil
}

// Bytes returns a chronological copy of the buffered logs, trimmed to the first complete line.
func (b *RingBuffer) Bytes() []byte {
	b.mu.Lock()
	var out []byte
	if !b.full {
		out = make([]byte, b.pos)
		copy(out, b.buf[:b.pos])
	} else {
		out = make([]byte, len(b.buf))
		n := copy(out, b.buf[b.pos:])
		copy(out[n:], b.buf[:b.pos])
	}
	b.mu.Unlock()

	if b.full {
		if idx := bytes.IndexByte(out, '\n'); idx != -1 && idx+1 < len(out) {
			out = out[idx+1:]
		}
	}
	return out
}

// DumpToFile writes the current in-memory log snapshot to the target path.
func (b *RingBuffer) DumpToFile(path string) error {
	return os.WriteFile(path, b.Bytes(), 0600)
}
