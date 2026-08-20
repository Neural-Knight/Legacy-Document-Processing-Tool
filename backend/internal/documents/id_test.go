package documents

import "testing"

func TestBase36Encode(t *testing.T) {
	cases := []struct {
		in   int64
		want string
	}{
		{0, "0"},
		{1, "1"},
		{35, "z"},
		{36, "10"},
		{1000, "rs"},
	}
	for _, c := range cases {
		if got := base36Encode(c.in); got != c.want {
			t.Errorf("base36Encode(%d) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestGenerateDocumentID(t *testing.T) {
	id := generateDocumentID()
	if id == "" {
		t.Fatal("expected a non-empty id")
	}
	for _, r := range id {
		if !((r >= '0' && r <= '9') || (r >= 'a' && r <= 'z')) {
			t.Fatalf("id %q contains non-base36 char %q", id, r)
		}
	}
}
