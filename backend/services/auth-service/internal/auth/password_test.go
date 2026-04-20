package auth

import "testing"

func TestHashPassword(t *testing.T) {
	t.Run("password is changing", func(t *testing.T) {
		password := "password"
		hashed, err := HashPassword(password)
		if err != nil {
			t.Fatalf("got error when tried to hash password, %v", err)
		}

		if password == hashed {
			t.Fatalf("hash password is equal to not hashed one")
		}
	})

	t.Run("hashing is using salt", func(t *testing.T) {
		password := "password"

		hashed1, err := HashPassword(password)
		if err != nil {
			t.Fatalf("got error when tried to hash password, %v", err)
		}

		hashed2, err := HashPassword(password)
		if err != nil {
			t.Fatalf("got error when tried to hash password, %v", err)
		}

		if hashed1 == hashed2 {
			t.Fatal("same passwords hashed twice are the same. Seems that hashing is not using salt")
		}
	})
}

func TestComparePasswords(t *testing.T) {
	t.Run("correct route", func(t *testing.T) {
		password := "password"

		hashed, err := HashPassword(password)
		if err != nil {
			t.Fatalf("got error when tried to hash password, %v", err)
		}

		if !ComparePasswords(hashed, password) {
			t.Fatal("used correct password and hash, but got false")
		}
	})

	t.Run("bad password or hash", func(t *testing.T) {
		password := "password"
		anotherPassword := "password2"

		hashed, err := HashPassword(password)
		if err != nil {
			t.Fatalf("got error when tried to hash password, %v", err)
		}

		hashedAnother, err := HashPassword(anotherPassword)
		if err != nil {
			t.Fatalf("got error when tried to hash another password, %v", err)
		}

		if ComparePasswords(password, hashedAnother) {
			t.Fatal("password and hashed of another password should not be fine")
		}

		if ComparePasswords(anotherPassword, hashed) {
			t.Fatal("another password and hashed should not be fine")
		}
	})
}
