package api

import "time"

func durationMinutes(m int) time.Duration {
	return time.Duration(m) * time.Minute
}
