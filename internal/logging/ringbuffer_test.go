package logging

import (
	"testing"

	"github.com/alecthomas/assert/v2"
)

func TestRingBuffer(t *testing.T) {

	tests := []struct {
		name     string
		input    []string
		expected string
	}{
		{"empty", []string{""}, ""},
		{"single array less than cap", []string{"hello"}, "hello"},
		{"single array exactly cap", []string{"1234567890"}, "1234567890"},
		{"single array exceeds cap", []string{"1234567890abcde"}, "67890abcde"},
		{"two line single array exceeds cap", []string{"1234567890\nabcde"}, "abcde"},
		{"multi-line single array exceeds cap", []string{"123456789\n0abc\nde"}, "0abc\nde"},
		{"multiple array less than cap", []string{"hello", " bob"}, "hello bob"},
		{"multiple array exactly cap", []string{"123456", "7890"}, "1234567890"},
		{"multiple array exceeds cap", []string{"123456", "7890ab", "cde"}, "67890abcde"},
		{"multi-line multiple array exceeds cap", []string{"1234567\n890", "abcde", "fg"}, "890abcdefg"},
	}

	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			buf := NewRingBuffer(10)

			for _, in := range testCase.input {
				n, err := buf.Write([]byte(in))
				assert.NoError(t, err)
				assert.Equal(t, len(in), n)
			}

			assert.Equal(t, testCase.expected, string(buf.Bytes()))
		})
	}
}
