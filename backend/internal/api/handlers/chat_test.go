package handlers

import (
	"encoding/json"
	"testing"
)

func TestFlexIDsParsing(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want []int32
	}{
		{"numbers", `{"document_ids":[1,2,3]}`, []int32{1, 2, 3}},
		{"strings", `{"document_ids":["4","5"]}`, []int32{4, 5}},
		{"mixed", `{"document_ids":[6,"7"]}`, []int32{6, 7}},
		{"null", `{"document_ids":null}`, nil},
		{"absent", `{"message":"hi"}`, nil},
		{"empty", `{"document_ids":[]}`, []int32{}},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			var req chatRequest
			if err := json.Unmarshal([]byte(c.in), &req); err != nil {
				t.Fatalf("unmarshal: %v", err)
			}
			got := []int32(req.DocumentIDs)
			if len(got) != len(c.want) {
				t.Fatalf("len mismatch: got %v want %v", got, c.want)
			}
			for i := range got {
				if got[i] != c.want[i] {
					t.Fatalf("at %d: got %d want %d", i, got[i], c.want[i])
				}
			}
		})
	}
}

func TestFlexIDsRejectsNonNumeric(t *testing.T) {
	var req chatRequest
	if err := json.Unmarshal([]byte(`{"document_ids":["abc"]}`), &req); err == nil {
		t.Fatal("expected error for non-numeric string id")
	}
}
