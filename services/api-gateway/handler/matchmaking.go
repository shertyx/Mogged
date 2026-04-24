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
	Type    string `json:"type"`
	MatchID string `json:"match_id,omitempty"`
	Opponent string `json:"opponent,omitempty"`
	Message string `json:"message,omitempty"`
}

// HandleMatchmaking upgrades the connection, adds the user to the queue,
// and pairs them with the next waiting user.
func (q *MatchQueue) HandleMatchmaking(eloServiceURL string) http.HandlerFunc {
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

			// wait up to 5 minutes for an opponent
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

		msg := matchMsg{Type: "matched", MatchID: matchID}
		msg.Opponent = userID
		opponent.conn.WriteJSON(msg)
		msg.Opponent = opponent.userID
		conn.WriteJSON(msg)
	}
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
