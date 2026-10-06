package main

import (
	"fmt"
	"log"
	"testing"
	"time"
	"uuid"
)

func TestFoo(t *testing.T) {
	scheduler, err := NewScheduler()

	if err != nil {
		log.Fatal(err)
	}

	id := uuid.NewV4()

	err = scheduler.ScheduleOneShot(id, "test", time.Now().Add(10*time.Second), func() {
		fmt.Println("Job happened!")
	})

	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("SUCCESS!\n")

	err = scheduler.ScheduleOneShot(id, "test", time.Now().Add(2*time.Second), func() {
		fmt.Println("Job happened!")
	})

	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("SUCCESS!\n")

	time.Sleep(15 * time.Second)

	scheduler.Shutdown()
}
