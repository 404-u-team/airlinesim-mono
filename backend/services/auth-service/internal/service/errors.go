package service

import "errors"

var ErrInternal = errors.New("internal server error")

var ErrUserWithSuchEmailExists = errors.New("user with such email already exists")
var ErrUserWithSuchNicknameExists = errors.New("user with such nickname already exists")
var ErrUserNotFound = errors.New("user with such email or password is not found")
