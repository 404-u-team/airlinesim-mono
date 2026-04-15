package dto

// TODO: make better validation
type RegisterRequest struct {
	Email    string `json:"email"    binding:"required,email,max=255"`
	Nickname string `json:"nickname" binding:"required,min=3,max=50,alphanum"`
	Password string `json:"password" binding:"required,min=8,max=72,excludesall=0x2F0x270x60"`
}

type LoginRequest struct {
	Login    string `json:"login"    binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"required,min=8,max=72,excludesall=0x2F0x270x60"`
}
type AccessTokenResponse struct {
	AccessToken string `json:"access_token"`
}
