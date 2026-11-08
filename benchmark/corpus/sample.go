package main

import "fmt"

type User struct {
	Name string
	Tags []string
}

func main() {
	users := map[string]User{
		"ada": {Name: "Ada", Tags: []string{"admin"}},
	}
	raw := `{"enabled": true}`
	runeValue := 'a'
	fmt.Println(users, raw, runeValue)
}
