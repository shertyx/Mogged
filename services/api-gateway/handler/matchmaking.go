package handler

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type queueEntry struct {
	userID  string
	photoID string
	conn    *websocket.Conn
	joined  time.Time
}

type MatchQueue struct {
	mu      sync.Mutex
	waiting *queueEntry
}

func NewMatchQueue() *MatchQueue {
	return &MatchQueue{}
}

type matchMsg struct {
	Type       string  `json:"type"`
	MatchID    string  `json:"match_id,omitempty"`
	Message    string  `json:"message,omitempty"`
	MyScore    float64 `json:"my_score,omitempty"`
	OppScore   float64 `json:"opp_score,omitempty"`
	WinnerIsMe bool    `json:"winner_is_me,omitempty"`
	MyPhoto    string  `json:"my_photo,omitempty"`
	OppPhoto   string  `json:"opp_photo,omitempty"`
}

type joinMsg struct {
	Type    string `json:"type"`
	PhotoID string `json:"photo_id"`
	Token   string `json:"token"`
}

func parseJWTUserID(tokenStr, secret string) (string, error) {
	token, err := jwt.Parse(tokenStr, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, jwt.ErrSignatureInvalid
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return "", fmt.Errorf("invalid token")
	}
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return "", fmt.Errorf("invalid claims")
	}
	userID, _ := claims["sub"].(string)
	return userID, nil
}

func (q *MatchQueue) HandleMatchmaking(eloServiceURL, faceServiceURL, userServiceURL, jwtSecret string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("ws upgrade:", err)
			return
		}

		// Read join message with photo_id before entering queue
		conn.SetReadDeadline(time.Now().Add(30 * time.Second))
		_, raw, err := conn.ReadMessage()
		if err != nil {
			conn.WriteJSON(matchMsg{Type: "error", Message: "expected join message"})
			conn.Close()
			return
		}
		var join joinMsg
		if err := json.Unmarshal(raw, &join); err != nil || join.Type != "join" || join.PhotoID == "" {
			conn.WriteJSON(matchMsg{Type: "error", Message: "invalid join message"})
			conn.Close()
			return
		}
		conn.SetReadDeadline(time.Time{})

		userID, err := parseJWTUserID(join.Token, jwtSecret)
		if err != nil || userID == "" {
			conn.WriteJSON(matchMsg{Type: "error", Message: "unauthorized"})
			conn.Close()
			return
		}

		entry := &queueEntry{userID: userID, photoID: join.PhotoID, conn: conn, joined: time.Now()}

		q.mu.Lock()
		if q.waiting == nil {
			q.waiting = entry
			q.mu.Unlock()

			conn.WriteJSON(matchMsg{Type: "waiting"})

			// Wait up to 5 minutes for an opponent
			conn.SetReadDeadline(time.Now().Add(5 * time.Minute))
			conn.ReadMessage()
			q.mu.Lock()
			if q.waiting == entry {
				q.waiting = nil
				q.mu.Unlock()
				conn.WriteJSON(matchMsg{Type: "timeout", Message: "no opponent found"})
				conn.Close()
			} else {
				q.mu.Unlock()
			}
			return
		}

		opponent := q.waiting
		q.waiting = nil
		q.mu.Unlock()

		matchID, err := createRealtimeMatch(eloServiceURL, opponent.userID, userID)
		if err != nil {
			log.Println("create match:", err)
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "failed to create match"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "failed to create match"})
			opponent.conn.Close()
			conn.Close()
			return
		}

		opponent.conn.WriteJSON(matchMsg{Type: "matched", MatchID: matchID})
		conn.WriteJSON(matchMsg{Type: "matched", MatchID: matchID})

		opponent.conn.WriteJSON(matchMsg{Type: "analyzing"})
		conn.WriteJSON(matchMsg{Type: "analyzing"})

		// Analyze both photos concurrently
		type analyzeResult struct {
			score float64
			s3Key string
			err   error
		}

		getS3Key := func(photoID string) (string, error) {
			resp, err := http.Get(userServiceURL + "/user/photos/by-id?photo_id=" + photoID)
			if err != nil {
				return "", err
			}
			defer resp.Body.Close()
			var photo struct {
				S3Key string `json:"s3_key"`
			}
			json.NewDecoder(resp.Body).Decode(&photo)
			if photo.S3Key == "" {
				return "", fmt.Errorf("s3_key not found for photo %s", photoID)
			}
			return photo.S3Key, nil
		}

		analyzeStored := func(photoID, userIDForHeader string) analyzeResult {
			s3Key, err := getS3Key(photoID)
			if err != nil || s3Key == "" {
				return analyzeResult{err: err}
			}
			var buf bytes.Buffer
			mw := multipart.NewWriter(&buf)
			_ = mw.WriteField("photo_id", photoID)
			_ = mw.WriteField("s3_key", s3Key)
			mw.Close()
			req, err := http.NewRequest(http.MethodPost, faceServiceURL+"/face/photos/analyze-stored", &buf)
			if err != nil {
				return analyzeResult{err: err}
			}
			req.Header.Set("Content-Type", mw.FormDataContentType())
			req.Header.Set("X-User-ID", userIDForHeader)
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return analyzeResult{err: err}
			}
			defer resp.Body.Close()
			if resp.StatusCode != http.StatusOK {
				b, _ := io.ReadAll(resp.Body)
				return analyzeResult{err: fmt.Errorf("face-service: %s", b)}
			}
			var result struct {
				ChadScore float64 `json:"chad_score"`
			}
			json.NewDecoder(resp.Body).Decode(&result)
			return analyzeResult{score: result.ChadScore, s3Key: s3Key}
		}

		aCh := make(chan analyzeResult, 1)
		bCh := make(chan analyzeResult, 1)
		go func() { aCh <- analyzeStored(opponent.photoID, opponent.userID) }()
		go func() { bCh <- analyzeStored(entry.photoID, entry.userID) }()
		aRes, bRes := <-aCh, <-bCh

		if aRes.err != nil || bRes.err != nil {
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "photo analysis failed"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "photo analysis failed"})
			opponent.conn.Close()
			conn.Close()
			return
		}

		// Get signed URLs for result display
		getSignedURL := func(s3Key string) string {
			body, _ := json.Marshal(map[string][]string{"s3_keys": {s3Key}})
			resp, err := http.Post(faceServiceURL+"/face/photos/signed-urls", "application/json", bytes.NewReader(body))
			if err != nil {
				return ""
			}
			defer resp.Body.Close()
			var result struct {
				URLs map[string]string `json:"urls"`
			}
			json.NewDecoder(resp.Body).Decode(&result)
			return result.URLs[s3Key]
		}

		aURL := getSignedURL(aRes.s3Key)
		bURL := getSignedURL(bRes.s3Key)

		aWon := aRes.score >= bRes.score

		// Resolve match
		resolveBody := map[string]interface{}{
			"match_id": matchID,
			"player_a": opponent.userID,
			"player_b": userID,
			"rounds": []map[string]interface{}{
				{"photo_a": opponent.photoID, "photo_b": entry.photoID, "score_a": aRes.score, "score_b": bRes.score},
			},
		}
		resolveMatch(eloServiceURL, resolveBody)

		// Mark photos as used
		markUsed := func(photoID string) {
			b, _ := json.Marshal(map[string]string{"photo_id": photoID})
			req, _ := http.NewRequest(http.MethodPatch, userServiceURL+"/user/photos/mark-used", bytes.NewReader(b))
			req.Header.Set("Content-Type", "application/json")
			resp, err := http.DefaultClient.Do(req)
			if err == nil {
				resp.Body.Close()
			}
		}
		markUsed(opponent.photoID)
		markUsed(entry.photoID)

		opponent.conn.WriteJSON(matchMsg{
			Type: "match_end", WinnerIsMe: aWon,
			MyScore: aRes.score, OppScore: bRes.score,
			MyPhoto: aURL, OppPhoto: bURL,
		})
		conn.WriteJSON(matchMsg{
			Type: "match_end", WinnerIsMe: !aWon,
			MyScore: bRes.score, OppScore: aRes.score,
			MyPhoto: bURL, OppPhoto: aURL,
		})

		opponent.conn.Close()
		conn.Close()
	}
}

func createRealtimeMatch(eloServiceURL, playerA, playerB string) (string, error) {
	body, _ := json.Marshal(map[string]string{
		"player_a": playerA,
		"player_b": playerB,
		"mode":     "realtime",
	})
	resp, err := http.Post(eloServiceURL+"/elo/match/create", "application/json", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	var result struct {
		MatchID string `json:"match_id"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.MatchID, nil
}

func resolveMatch(eloServiceURL string, body map[string]interface{}) error {
	b, _ := json.Marshal(body)
	resp, err := http.Post(eloServiceURL+"/elo/match/resolve", "application/json", bytes.NewReader(b))
	if err != nil {
		return err
	}
	resp.Body.Close()
	return nil
}
