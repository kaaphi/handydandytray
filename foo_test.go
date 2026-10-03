package main

import (
	"fmt"
	"log"
	"testing"
	"time"
	"uuid"
)

func TestFoo(t *testing.T) {
	ctx := t.Context()

	db, err := InitDB(ctx, "test.db")

	if err != nil {
		log.Fatal(err)
	}

	todoService := TodoService{
		db: db,
	}

	err = todoService.UpdateTodo(ctx, Todo{
		ID:          uuid.MustParse("01a0dfe4-aeac-7acd-a933-639849530273"),
		Description: "My TODO UPDATED",
		CompletedAt: time.Now(),
	})
	if err != nil {
		log.Fatal(err)
	}

	todos, err := todoService.GetTodos(ctx)

	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("%+v\n", todos)
}
