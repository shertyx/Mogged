package service_test

import (
	"testing"
	"time"

	"github.com/mogged/elo-service/repository"
	"github.com/mogged/elo-service/service"
)

type mockRepo struct {
	elo map[string]int
}

func newMockRepo() *mockRepo {
	return &mockRepo{elo: make(map[string]int)}
}

func (m *mockRepo) GetElo(userID string) (int, error) {
	if v, ok := m.elo[userID]; ok {
		return v, nil
	}
	return 1000, nil
}
func (m *mockRepo) UpsertElo(userID string, score int, tier string) error {
	m.elo[userID] = score
	return nil
}
func (m *mockRepo) CreateMatch(a, b, mode string, exp *time.Time) (string, error) {
	return "match-1", nil
}
func (m *mockRepo) GetMatch(id string) (*repository.Match, error)        { return nil, nil }
func (m *mockRepo) SetMatchReady(id string) error                        { return nil }
func (m *mockRepo) CompleteMatch(id, winner string) error                { return nil }
func (m *mockRepo) ExpireStaleMatches() ([]repository.Match, error)      { return nil, nil }
func (m *mockRepo) InsertRound(matchID, pA, pB, wP string, r int) error  { return nil }

func TestTierFromELO(t *testing.T) {
	cases := []struct{ score int; want string }{
		{800, "bronze"}, {1200, "silver"}, {1400, "gold"},
		{1600, "platinum"}, {1800, "diamond"}, {2000, "master"},
		{2200, "grandmaster"}, {2400, "top500"},
	}
	for _, c := range cases {
		got := service.TierFromELO(c.score)
		if got != c.want {
			t.Errorf("TierFromELO(%d) = %s, want %s", c.score, got, c.want)
		}
	}
}

func TestResolveMatch_PlayerAWins(t *testing.T) {
	repo := newMockRepo()
	repo.elo["a"] = 1000
	repo.elo["b"] = 1000
	svc := service.NewEloService(repo)

	rounds := []service.RoundInput{
		{PhotoA: "p1", PhotoB: "p2", ScoreA: 80, ScoreB: 60},
		{PhotoA: "p3", PhotoB: "p4", ScoreA: 75, ScoreB: 70},
		{PhotoA: "p5", PhotoB: "p6", ScoreA: 50, ScoreB: 90},
	}
	winner, err := svc.ResolveMatch("match-1", "a", "b", rounds)
	if err != nil {
		t.Fatal(err)
	}
	if winner != "a" {
		t.Fatalf("expected winner a, got %s", winner)
	}
	if repo.elo["a"] <= 1000 {
		t.Fatal("winner ELO should increase")
	}
	if repo.elo["b"] >= 1000 {
		t.Fatal("loser ELO should decrease")
	}
}

func TestResolveMatch_WrongRoundCount(t *testing.T) {
	svc := service.NewEloService(newMockRepo())
	_, err := svc.ResolveMatch("x", "a", "b", []service.RoundInput{})
	if err == nil {
		t.Fatal("expected error for wrong round count")
	}
}
