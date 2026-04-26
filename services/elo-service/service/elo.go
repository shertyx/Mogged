package service

import (
	"fmt"
	"math"
	"time"

	"github.com/mogged/elo-service/repository"
)

const kFactor = 32

type EloRepoIface interface {
	GetElo(userID string) (int, error)
	UpsertElo(userID string, score int, tier string) error
	CreateMatch(playerA, playerB, mode string, expiresAt *time.Time) (string, error)
	GetMatch(matchID string) (*repository.Match, error)
	SetMatchReady(matchID string) error
	CompleteMatch(matchID, winnerID string) error
	ExpireStaleMatches() ([]repository.Match, error)
	InsertRound(matchID, photoA, photoB, winnerPhoto string, round int) error
	InsertMatchHistory(matchID, userID, opponentID string, won bool, eloChange int) error
	GetLeaderboard(limit int) ([]repository.LeaderboardEntry, error)
	GetMatchHistory(userID string, limit int) ([]repository.MatchHistoryEntry, error)
	CreateDuelRequest(challengerID, challengedID string, photoIDs []string) (string, error)
	ListPendingDuels(userID string) ([]repository.DuelRequest, error)
	GetDuelRequest(duelID string) (*repository.DuelRequest, error)
	ResolveDuelRequest(duelID, matchID string) error
	DeclineDuelRequest(duelID string) error
	GetPhotoScore(photoID string) (float64, error)
	GetFeed(userID string, limit int) ([]repository.FeedEntry, error)
}

type EloService struct {
	repo EloRepoIface
}

func NewEloService(repo EloRepoIface) *EloService {
	return &EloService{repo: repo}
}

type TierInfo struct {
	Name     string `json:"name"`
	Division int    `json:"division"` // 5 (lowest) → 1 (highest), 0 for Master+
	SR       int    `json:"sr"`
}

// Thresholds: each tier = 500 SR, 5 divisions of 100 SR each
// Start: 1000 SR = Silver 5
var tiers = []struct {
	name string
	min  int
}{
	{"Bronze", 0},
	{"Silver", 500},
	{"Gold", 1000},
	{"Platinum", 1500},
	{"Diamond", 2000},
	{"Master", 2500},
	{"Grandmaster", 3000},
	{"Top 500", 3500},
}

func TierInfoFromELO(score int) TierInfo {
	if score < 0 {
		score = 0
	}
	tier := tiers[0]
	for _, t := range tiers {
		if score >= t.min {
			tier = t
		} else {
			break
		}
	}
	division := 0
	if tier.name != "Master" && tier.name != "Grandmaster" && tier.name != "Top 500" {
		div := 5 - (score-tier.min)/100
		if div < 1 {
			div = 1
		}
		division = div
	}
	return TierInfo{Name: tier.name, Division: division, SR: score}
}

func TierFromELO(score int) string {
	info := TierInfoFromELO(score)
	if info.Division > 0 {
		return info.Name + " " + string(rune('0'+info.Division))
	}
	return info.Name
}

func calculateELO(winner, loser int) (newWinner, newLoser int) {
	expectedWinner := 1.0 / (1.0 + math.Pow(10, float64(loser-winner)/400.0))
	expectedLoser := 1.0 - expectedWinner
	newWinner = winner + int(math.Round(kFactor*(1-expectedWinner)))
	newLoser = loser + int(math.Round(kFactor*(0-expectedLoser)))
	if newLoser < 0 {
		newLoser = 0
	}
	return
}

func (s *EloService) GetElo(userID string) (int, string, error) {
	score, err := s.repo.GetElo(userID)
	if err != nil {
		return 0, "", err
	}
	return score, TierFromELO(score), nil
}

func (s *EloService) ResolveMatch(matchID, playerA, playerB string, rounds []RoundInput) (string, error) {
	if len(rounds) == 0 {
		return "", fmt.Errorf("no rounds provided")
	}

	winsA, winsB := 0, 0
	for i, r := range rounds {
		var winnerPhoto string
		if r.ScoreA >= r.ScoreB {
			winsA++
			winnerPhoto = r.PhotoA
		} else {
			winsB++
			winnerPhoto = r.PhotoB
		}
		if err := s.repo.InsertRound(matchID, r.PhotoA, r.PhotoB, winnerPhoto, i+1); err != nil {
			return "", err
		}
	}

	var winnerID, loserID string
	if winsA >= winsB {
		winnerID, loserID = playerA, playerB
	} else {
		winnerID, loserID = playerB, playerA
	}

	if err := s.repo.CompleteMatch(matchID, winnerID); err != nil {
		return "", err
	}

	winnerScore, err := s.repo.GetElo(winnerID)
	if err != nil {
		return "", err
	}
	loserScore, err := s.repo.GetElo(loserID)
	if err != nil {
		return "", err
	}

	newWinner, newLoser := calculateELO(winnerScore, loserScore)
	winnerGain := newWinner - winnerScore
	loserGain := newLoser - loserScore

	if err := s.repo.UpsertElo(winnerID, newWinner, TierFromELO(newWinner)); err != nil {
		return "", err
	}
	if err := s.repo.UpsertElo(loserID, newLoser, TierFromELO(newLoser)); err != nil {
		return "", err
	}

	_ = s.repo.InsertMatchHistory(matchID, winnerID, loserID, true, winnerGain)
	_ = s.repo.InsertMatchHistory(matchID, loserID, winnerID, false, loserGain)

	return winnerID, nil
}

func (s *EloService) GetLeaderboard(limit int) ([]repository.LeaderboardEntry, error) {
	return s.repo.GetLeaderboard(limit)
}

func (s *EloService) GetMatchHistory(userID string, limit int) ([]repository.MatchHistoryEntry, error) {
	return s.repo.GetMatchHistory(userID, limit)
}

type RoundInput struct {
	PhotoA string
	PhotoB string
	ScoreA float64
	ScoreB float64
}

func (s *EloService) CreateMatch(playerA, playerB, mode string) (string, error) {
	var expiresAt *time.Time
	if mode == "async" {
		t := time.Now().Add(24 * time.Hour)
		expiresAt = &t
	}
	return s.repo.CreateMatch(playerA, playerB, mode, expiresAt)
}

func (s *EloService) SetMatchReady(matchID string) error {
	return s.repo.SetMatchReady(matchID)
}

func (s *EloService) GetMatch(matchID string) (*repository.Match, error) {
	return s.repo.GetMatch(matchID)
}

func (s *EloService) ExpireStaleMatches() ([]repository.Match, error) {
	return s.repo.ExpireStaleMatches()
}

func (s *EloService) SendDuelRequest(challengerID, challengedID string, photoIDs []string) (string, error) {
	return s.repo.CreateDuelRequest(challengerID, challengedID, photoIDs)
}

func (s *EloService) ListPendingDuels(userID string) ([]repository.DuelRequest, error) {
	return s.repo.ListPendingDuels(userID)
}

func (s *EloService) AcceptDuelRequest(duelID, challengedID string, challengedPhotos []string) (string, error) {
	duel, err := s.repo.GetDuelRequest(duelID)
	if err != nil || duel == nil {
		return "", fmt.Errorf("duel request not found")
	}
	if duel.ChallengedID != challengedID {
		return "", fmt.Errorf("unauthorized")
	}
	if duel.Status != "pending" {
		return "", fmt.Errorf("duel already resolved")
	}

	matchID, err := s.repo.CreateMatch(duel.ChallengerID, challengedID, "async", nil)
	if err != nil {
		return "", err
	}

	scoreA, _ := s.repo.GetPhotoScore(duel.ChallengerPhotos[0])
	scoreB, _ := s.repo.GetPhotoScore(challengedPhotos[0])
	rounds := []RoundInput{{
		PhotoA: duel.ChallengerPhotos[0],
		PhotoB: challengedPhotos[0],
		ScoreA: scoreA,
		ScoreB: scoreB,
	}}
	winnerID, err := s.ResolveMatch(matchID, duel.ChallengerID, challengedID, rounds)
	if err != nil {
		return "", err
	}

	if err := s.repo.ResolveDuelRequest(duelID, matchID); err != nil {
		return "", err
	}

	return winnerID, nil
}

func (s *EloService) DeclineDuelRequest(duelID, challengedID string) error {
	duel, err := s.repo.GetDuelRequest(duelID)
	if err != nil || duel == nil {
		return fmt.Errorf("duel request not found")
	}
	if duel.ChallengedID != challengedID {
		return fmt.Errorf("unauthorized")
	}
	return s.repo.DeclineDuelRequest(duelID)
}

func (s *EloService) GetFeed(userID string, limit int) ([]repository.FeedEntry, error) {
	return s.repo.GetFeed(userID, limit)
}
