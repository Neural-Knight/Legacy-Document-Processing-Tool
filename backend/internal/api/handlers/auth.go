package handlers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	"github.com/legacy-document-processing-tool/backend/internal/auth"
	"github.com/legacy-document-processing-tool/backend/internal/repository"
)

// AuthHandler serves the /api/auth/* endpoints.
type AuthHandler struct {
	queries              *repository.Queries
	auth                 *auth.Service
	accessTTL            time.Duration
	refreshTTLRememberMe time.Duration // used when remember_me = true
	refreshTTLDefault    time.Duration // 24h when remember_me = false
}

// NewAuthHandler builds the auth handler with configured token lifetimes.
func NewAuthHandler(queries *repository.Queries, svc *auth.Service, accessMinutes, refreshDays int) *AuthHandler {
	return &AuthHandler{
		queries:              queries,
		auth:                 svc,
		accessTTL:            time.Duration(accessMinutes) * time.Minute,
		refreshTTLRememberMe: time.Duration(refreshDays) * 24 * time.Hour,
		refreshTTLDefault:    24 * time.Hour,
	}
}

// ---- DTOs (request/response JSON shapes) ----

type userResponse struct {
	ID          int32      `json:"id"`
	Email       string     `json:"email"`
	Username    string     `json:"username"`
	IsActive    bool       `json:"is_active"`
	FirstName   *string    `json:"first_name"`
	LastName    *string    `json:"last_name"`
	FullName    string     `json:"full_name"`
	IsSuperuser bool       `json:"is_superuser"`
	CreatedAt   *time.Time `json:"created_at"`
	UpdatedAt   *time.Time `json:"updated_at"`
}

func toUserResponse(u repository.User) userResponse {
	resp := userResponse{
		ID:        u.ID,
		Email:     u.Email,
		Username:  u.Username,
		FirstName: u.FirstName,
		LastName:  u.LastName,
		FullName:  fullName(u),
	}
	if u.IsActive != nil {
		resp.IsActive = *u.IsActive
	}
	if u.IsSuperuser != nil {
		resp.IsSuperuser = *u.IsSuperuser
	}
	if u.CreatedAt.Valid {
		t := u.CreatedAt.Time
		resp.CreatedAt = &t
	}
	if u.UpdatedAt.Valid {
		t := u.UpdatedAt.Time
		resp.UpdatedAt = &t
	}
	return resp
}

// fullName joins the user's first and last name.
func fullName(u repository.User) string {
	if u.FirstName != nil && u.LastName != nil && *u.FirstName != "" && *u.LastName != "" {
		return *u.FirstName + " " + *u.LastName
	}
	return u.Username
}

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
}

type registerRequest struct {
	Email     string  `json:"email"`
	Username  string  `json:"username"`
	Password  string  `json:"password"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
}

type loginRequest struct {
	Username   string `json:"username"`
	Password   string `json:"password"`
	RememberMe bool   `json:"remember_me"`
}

type refreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type updateMeRequest struct {
	Email     *string `json:"email"`
	FirstName *string `json:"first_name"`
	LastName  *string `json:"last_name"`
	Password  *string `json:"password"`
}

// ---- Validation ----

var usernameRe = regexp.MustCompile(`^[a-zA-Z0-9_-]+$`)

func validateUsername(u string) error {
	if !usernameRe.MatchString(u) {
		return errors.New("Username must be alphanumeric and may include underscores or hyphens")
	}
	return nil
}

func validatePassword(p string) error {
	if len(p) < 8 {
		return errors.New("Password must be at least 8 characters long")
	}
	if !strings.ContainsAny(p, "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
		return errors.New("Password must contain at least one uppercase letter")
	}
	if !strings.ContainsAny(p, "abcdefghijklmnopqrstuvwxyz") {
		return errors.New("Password must contain at least one lowercase letter")
	}
	if !strings.ContainsAny(p, "0123456789") {
		return errors.New("Password must contain at least one number")
	}
	return nil
}

// ---- Handlers ----

// Register creates a new user (POST /api/auth/register).
func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req registerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	if req.Email == "" || req.Username == "" {
		writeError(w, http.StatusUnprocessableEntity, "email and username are required")
		return
	}
	if err := validateUsername(req.Username); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	if err := validatePassword(req.Password); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}

	ctx := r.Context()
	if _, err := h.queries.GetUserByEmail(ctx, req.Email); err == nil {
		writeError(w, http.StatusBadRequest, "A user with this email already exists")
		return
	}
	if _, err := h.queries.GetUserByUsername(ctx, req.Username); err == nil {
		writeError(w, http.StatusBadRequest, "A user with this username already exists")
		return
	}

	hashed, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	active := true
	user, err := h.queries.CreateUser(ctx, repository.CreateUserParams{
		Email:          req.Email,
		Username:       req.Username,
		HashedPassword: hashed,
		FirstName:      req.FirstName,
		LastName:       req.LastName,
		IsActive:       &active,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	writeJSON(w, http.StatusCreated, toUserResponse(user))
}

// Login authenticates by username or email and issues tokens
// (POST /api/auth/login).
func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req loginRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	h.authenticateAndRespond(w, r, req.Username, req.Password, req.RememberMe)
}

// LoginAccessToken is the OAuth2 form-encoded variant used by Swagger UI
// (POST /api/auth/login/access-token).
func (h *AuthHandler) LoginAccessToken(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid form body")
		return
	}
	username := r.PostFormValue("username")
	password := r.PostFormValue("password")
	// OAuth2 form has no remember_me; use the full refresh expiry here.
	h.authenticateAndRespond(w, r, username, password, true)
}

func (h *AuthHandler) authenticateAndRespond(w http.ResponseWriter, r *http.Request, username, password string, rememberMe bool) {
	ctx := r.Context()

	user, ok := h.lookupUser(ctx, username)
	if !ok || !auth.VerifyPassword(password, user.HashedPassword) {
		respondUnauthorized(w, "Incorrect username or password")
		return
	}
	if user.IsActive == nil || !*user.IsActive {
		respondUnauthorized(w, "Inactive user")
		return
	}

	accessToken, err := h.auth.Tokens().CreateAccessToken(int64(user.ID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	refreshTTL := h.refreshTTLRememberMe
	if !rememberMe {
		refreshTTL = h.refreshTTLDefault
	}
	ua := r.Header.Get("User-Agent")
	ip := clientIP(r)
	refreshToken, err := h.auth.CreateRefreshToken(ctx, user.ID, ua, ip, refreshTTL)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	writeJSON(w, http.StatusOK, tokenResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "bearer",
		ExpiresIn:    int(h.accessTTL.Seconds()),
	})
}

// RefreshToken rotates a valid refresh token, revoking the old one
// (POST /api/auth/refresh-token).
func (h *AuthHandler) RefreshToken(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	ctx := r.Context()

	userID, ok := h.auth.ValidateRefreshToken(ctx, req.RefreshToken)
	if !ok {
		respondUnauthorized(w, "Invalid or expired refresh token")
		return
	}

	user, err := h.queries.GetUserByID(ctx, userID)
	if err != nil || user.IsActive == nil || !*user.IsActive {
		_, _ = h.auth.RevokeRefreshToken(ctx, req.RefreshToken)
		respondUnauthorized(w, "User not found or inactive")
		return
	}

	accessToken, err := h.auth.Tokens().CreateAccessToken(int64(user.ID))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	// Token rotation: revoke old, mint new.
	if _, err := h.auth.RevokeRefreshToken(ctx, req.RefreshToken); err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	ua := r.Header.Get("User-Agent")
	ip := clientIP(r)
	newRefresh, err := h.auth.CreateRefreshToken(ctx, user.ID, ua, ip, h.refreshTTLRememberMe)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}

	writeJSON(w, http.StatusOK, tokenResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefresh,
		TokenType:    "bearer",
		ExpiresIn:    int(h.accessTTL.Seconds()),
	})
}

// Logout revokes a single refresh token (POST /api/auth/logout).
func (h *AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	success, err := h.auth.RevokeRefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": success})
}

// LogoutAllDevices revokes every active refresh token for the current user
// (POST /api/auth/logout-all-devices).
func (h *AuthHandler) LogoutAllDevices(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	count, err := h.auth.RevokeAllUserRefreshTokens(r.Context(), user.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"success": true, "revoked_count": count})
}

// Me returns the current authenticated user (GET /api/auth/me).
func (h *AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	user, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}
	writeJSON(w, http.StatusOK, toUserResponse(user))
}

// UpdateMe updates the current user's profile and/or password
// (PUT /api/auth/me).
func (h *AuthHandler) UpdateMe(w http.ResponseWriter, r *http.Request) {
	current, ok := UserFromContext(r.Context())
	if !ok {
		respondUnauthorized(w, "Could not validate credentials")
		return
	}

	var req updateMeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusUnprocessableEntity, "Invalid request body")
		return
	}
	ctx := r.Context()

	email := current.Email
	if req.Email != nil && *req.Email != "" && *req.Email != current.Email {
		if existing, err := h.queries.GetUserByEmail(ctx, *req.Email); err == nil && existing.ID != current.ID {
			writeError(w, http.StatusBadRequest, "This email is already in use")
			return
		}
		email = *req.Email
	}

	firstName := current.FirstName
	if req.FirstName != nil {
		firstName = req.FirstName
	}
	lastName := current.LastName
	if req.LastName != nil {
		lastName = req.LastName
	}

	hashed := current.HashedPassword
	if req.Password != nil && *req.Password != "" {
		if err := validatePassword(*req.Password); err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		newHash, err := auth.HashPassword(*req.Password)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "Internal server error")
			return
		}
		hashed = newHash
	}

	updated, err := h.queries.UpdateUser(ctx, repository.UpdateUserParams{
		ID:             current.ID,
		Email:          email,
		FirstName:      firstName,
		LastName:       lastName,
		HashedPassword: hashed,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Internal server error")
		return
	}
	writeJSON(w, http.StatusOK, toUserResponse(updated))
}

// ---- helpers ----

// lookupUser tries username first, then email.
func (h *AuthHandler) lookupUser(ctx context.Context, identifier string) (repository.User, bool) {
	if u, err := h.queries.GetUserByUsername(ctx, identifier); err == nil {
		return u, true
	} else if !errors.Is(err, pgx.ErrNoRows) {
		return repository.User{}, false
	}
	if u, err := h.queries.GetUserByEmail(ctx, identifier); err == nil {
		return u, true
	}
	return repository.User{}, false
}

func respondUnauthorized(w http.ResponseWriter, detail string) {
	w.Header().Set("WWW-Authenticate", "Bearer")
	writeError(w, http.StatusUnauthorized, detail)
}

func clientIP(r *http.Request) string {
	host := r.RemoteAddr
	if i := strings.LastIndex(host, ":"); i != -1 {
		return host[:i]
	}
	return host
}
