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
	CreateMatch(playerA, playerB, mode string, expiresAt *time.Time, photoAID *string) (string, error)
	GetMatch(matchID string) (*repository.Match, error)
	SetMatchReady(matchID string) error
	SetMatchPhotos(matchID, photoAID, photoBID string) error
	CompleteMatch(matchID, winnerID string) error
	ExpireStaleMatches() ([]repository.Match, error)
	InsertRound(matchID, photoA, photoB, winnerPhoto string, round int) error
	ListPendingChallenges(userID string) ([]repository.Match, error)
	GetMatchPhotos(matchID string) (photoAID, photoBID string, err error)
}

type EloService struct {
	repo EloRepoIface
}

func NewEloService(repo EloRepoIface) *EloService {
	return &EloService{repo: repo}
}

func TierFromELO(score int) string {
	switch {
	case score < 1200:
		return "bronze"
	case score < 1400:
		return "silver"
	case score < 1600:
		return "gold"
	case score < 1800:
		return "platinum"
	case score < 2000:
		return "diamond"
	case score < 2200:
		return "master"
	case score < 2400:
		return "grandmaster"
	default:
		return "top500"
	}
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

// ResolveMatch determines match winner from rounds (1 round = highest score wins).
func (s *EloService) ResolveMatch(matchID, playerA, playerB string, rounds []RoundInput) (string, error) {
	if len(rounds) < 1 {
		return "", fmt.Errorf("expected at least 1 round, got 0")
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
	if err := s.repo.UpsertElo(winnerID, newWinner, TierFromELO(newWinner)); err != nil {
		return "", err
	}
	if err := s.repo.UpsertElo(loserID, newLoser, TierFromELO(newLoser)); err != nil {
		return "", err
	}

	return winnerID, nil
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
	return s.repo.CreateMatch(playerA, playerB, mode, expiresAt, nil)
}

func (s *EloService) CreateMatchWithPhoto(playerA, playerB, mode, photoAID string) (string, error) {
	var expiresAt *time.Time
	if mode == "async" {
		t := time.Now().Add(24 * time.Hour)
		expiresAt = &t
	}
	return s.repo.CreateMatch(playerA, playerB, mode, expiresAt, &photoAID)
}

func (s *EloService) ListPendingChallenges(userID string) ([]repository.Match, error) {
	return s.repo.ListPendingChallenges(userID)
}

func (s *EloService) SetMatchPhotos(matchID, photoAID, photoBID string) error {
	return s.repo.SetMatchPhotos(matchID, photoAID, photoBID)
}

func (s *EloService) GetMatchPhotos(matchID string) (string, string, error) {
	return s.repo.GetMatchPhotos(matchID)
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
