package handler

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

type queueEntry struct {
	userID string
	conn   *websocket.Conn
	joined time.Time
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
	Opponent   string  `json:"opponent,omitempty"`
	Message    string  `json:"message,omitempty"`
	Round      int     `json:"round,omitempty"`
	MyScore    float64 `json:"my_score,omitempty"`
	OppScore   float64 `json:"opp_score,omitempty"`
	WinnerIsMe bool    `json:"winner_is_me,omitempty"`
}

type photoSelectMsg struct {
	PhotoIDs []string `json:"photo_ids"`
}

type roundInput struct {
	PhotoA      string  `json:"photo_a"`
	PhotoB      string  `json:"photo_b"`
	ScoreA      float64 `json:"score_a"`
	ScoreB      float64 `json:"score_b"`
	WinnerPhoto string  `json:"winner_photo"`
}

func (q *MatchQueue) HandleMatchmaking(eloServiceURL string, userServiceURL string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("X-User-ID")
		if userID == "" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}

		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			log.Println("ws upgrade:", err)
			return
		}

		entry := &queueEntry{userID: userID, conn: conn, joined: time.Now()}

		q.mu.Lock()
		if q.waiting == nil {
			q.waiting = entry
			q.mu.Unlock()

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

		// Notify both players — they will send photo_ids after receiving "matched"
		opponent.conn.WriteJSON(matchMsg{Type: "matched", MatchID: matchID, Opponent: userID})
		conn.WriteJSON(matchMsg{Type: "matched", MatchID: matchID, Opponent: opponent.userID})

		// Read photo selections from both players concurrently
		type selectionResult struct {
			photoIDs []string
			err      error
		}
		aCh := make(chan selectionResult, 1)
		bCh := make(chan selectionResult, 1)

		readSelection := func(c *websocket.Conn, ch chan selectionResult) {
			c.SetReadDeadline(time.Now().Add(2 * time.Minute))
			_, msg, err := c.ReadMessage()
			if err != nil {
				ch <- selectionResult{err: err}
				return
			}
			var sel photoSelectMsg
			if err := json.Unmarshal(msg, &sel); err != nil || len(sel.PhotoIDs) != 3 {
				ch <- selectionResult{err: err}
				return
			}
			ch <- selectionResult{photoIDs: sel.PhotoIDs}
		}

		go readSelection(opponent.conn, aCh)
		go readSelection(conn, bCh)

		aResult := <-aCh
		bResult := <-bCh

		if aResult.err != nil || bResult.err != nil {
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "photo selection failed"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "photo selection failed"})
			opponent.conn.Close()
			conn.Close()
			return
		}

		// Fetch chad scores for all selected photos
		aScores, err := fetchPhotoScores(userServiceURL, aResult.photoIDs)
		if err != nil {
			log.Println("fetch scores player A:", err)
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			opponent.conn.Close()
			conn.Close()
			return
		}
		bScores, err := fetchPhotoScores(userServiceURL, bResult.photoIDs)
		if err != nil {
			log.Println("fetch scores player B:", err)
			opponent.conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			conn.WriteJSON(matchMsg{Type: "error", Message: "failed to fetch scores"})
			opponent.conn.Close()
			conn.Close()
			return
		}

		// Play 3 rounds — highest chad_score wins each round
		aWins, bWins := 0, 0
		var rounds []roundInput

		for i := 0; i < 3; i++ {
			sa := aScores[i]
			sb := bScores[i]
			winnerPhoto := aResult.photoIDs[i]
			if sb > sa {
				winnerPhoto = bResult.photoIDs[i]
				bWins++
			} else {
				aWins++
			}
			rounds = append(rounds, roundInput{
				PhotoA:      aResult.photoIDs[i],
				PhotoB:      bResult.photoIDs[i],
				ScoreA:      sa,
				ScoreB:      sb,
				WinnerPhoto: winnerPhoto,
			})
			opponent.conn.WriteJSON(matchMsg{Type: "round", Round: i + 1, MyScore: sa, OppScore: sb, WinnerIsMe: sa >= sb})
			conn.WriteJSON(matchMsg{Type: "round", Round: i + 1, MyScore: sb, OppScore: sa, WinnerIsMe: sb >= sa})
		}

		aWon := aWins > bWins

		// Resolve match in elo-service (updates ELO scores)
		resolveBody := map[string]interface{}{
			"match_id": matchID,
			"player_a": opponent.userID,
			"player_b": userID,
			"rounds":   rounds,
		}
		if err := resolveMatch(eloServiceURL, resolveBody); err != nil {
			log.Println("resolve match:", err)
		}

		// Send final result
		opponent.conn.WriteJSON(matchMsg{Type: "match_end", WinnerIsMe: aWon})
		conn.WriteJSON(matchMsg{Type: "match_end", WinnerIsMe: !aWon})

		opponent.conn.Close()
		conn.Close()
	}
}

func fetchPhotoScores(userServiceURL string, photoIDs []string) ([]float64, error) {
	scores := make([]float64, len(photoIDs))
	for i, id := range photoIDs {
		resp, err := http.Get(userServiceURL + "/user/photos?photo_id=" + id)
		if err != nil {
			return nil, err
		}
		defer resp.Body.Close()
		var photos []struct {
			ID        string  `json:"id"`
			ChadScore float64 `json:"chad_score"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&photos); err != nil {
			return nil, err
		}
		for _, p := range photos {
			if p.ID == id {
				scores[i] = p.ChadScore
				break
			}
		}
	}
	return scores, nil
}

func createRealtimeMatch(eloServiceURL, playerA, playerB string) (string, error) {
	body, _ := json.Marshal(map[string]string{
		"player_a": playerA,
		"player_b": playerB,
		"mode":     "realtime",
	})
	resp, err := http.Post(eloServiceURL+"/elo/match/create", "application/json",
		bytes.NewReader(body))
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
