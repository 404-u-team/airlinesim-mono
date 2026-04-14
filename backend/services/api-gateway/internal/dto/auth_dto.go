package dto

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email,max=255"`
	Nickname string `json:"nickname" binding:"min=3,max=50"`
	Password string `json:"password" binding:"min=8,max=72"`
}

type LoginRequest struct {
	Login    string `json:"login" binding:"required,min=3,max=50"`
	Password string `json:"password" binding:"min=8,max=72"`
}

type AccessTokenResponse struct {
	AccessToken string `json:"access_token"`
}
