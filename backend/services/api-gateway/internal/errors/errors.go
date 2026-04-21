package errors

import (
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
)

var ErrInternal = status.Error(codes.Internal, "internal error")

var ErrUserWithSuchEmailExists = status.Error(codes.AlreadyExists, "email taken")
var ErrUserWithSuchNicknameExists = status.Error(codes.AlreadyExists, "nickname taken")
var ErrUserNotFound = status.Error(codes.NotFound, "user is not found")
var ErrUserUnauthenticated = status.Error(codes.Unauthenticated, "user is unauthenticated")

var ErrISOConflict = status.Error(codes.AlreadyExists, "iso taken")

var ErrLocalCodeConflict = status.Error(codes.AlreadyExists, "local code taken")
var ErrNoSuchCountry = status.Error(codes.InvalidArgument, "country with such id not found")
