package handlers

import "testing"

func TestReleaseVersionsAndUpgradeTarget(t *testing.T) {
	branches := []string{"release/v5", "release/v5.5", "release/v5.10", "release/v4.9", "release/v6.0"}
	cases := []struct{ current, want string }{
		{"release/v5", "release/v6.0"},
		{"release/v5.5", "release/v6.0"},
		{"release/v6", ""},   // v6 == v6.0, nothing newer
		{"release/v6.0", ""}, // already newest
		{"main", ""},         // non-release branches are never auto-switched
		{"app/v4.6", ""},
	}
	for _, c := range cases {
		if got := newerRelease(c.current, branches); got != c.want {
			t.Errorf("newerRelease(%q) = %q, want %q", c.current, got, c.want)
		}
	}
	// numeric, not lexical: v5.10 > v5.5
	if compareVersions(releaseVersion("release/v5.10"), releaseVersion("release/v5.5")) != 1 {
		t.Error("v5.10 should be newer than v5.5")
	}
	if newerRelease("release/v5.5", []string{"release/v5", "release/v5.5", "release/v5.10"}) != "release/v5.10" {
		t.Error("expected v5.10 as upgrade from v5.5")
	}
	for _, bad := range []string{"release/v5;rm -rf /", "release/5.5", "release/v5..5", "feature/x"} {
		if releaseVersion(bad) != nil {
			t.Errorf("%q should not parse as a release branch", bad)
		}
	}
}
