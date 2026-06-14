import { useEffect, useMemo, useState } from 'react';
import { useMatchStore, liveTimeOnPitch, deriveMatchSeconds } from '../state/useMatchStore';
import { useTeamStore } from '../state/useTeamStore';
import { useScreenStore } from '../state/useScreenStore';
import { useTick } from '../hooks/useTick';
import { Clock } from '../components/Clock';
import { NextSubCountdown } from '../components/NextSubCountdown';
import { PlayerCard } from '../components/PlayerCard';
import { EmptySlotCard } from '../components/EmptySlotCard';
import { SubLogCard } from '../components/SubLogCard';
import { SortToggle } from '../components/SortToggle';
import { SubBar } from '../components/SubBar';
import type { Player } from '../domain/types';
import { HalfTimeOverlay } from '../overlays/HalfTimeOverlay';
import { FullTimeOverlay } from '../overlays/FullTimeOverlay';
import { FullTimeConfirmOverlay } from '../overlays/FullTimeConfirmOverlay';
import { ResetOverlay } from '../overlays/ResetOverlay';
import { PlayerOptionsOverlay } from '../overlays/PlayerOptionsOverlay';
import { AddPlayerOverlay } from '../overlays/AddPlayerOverlay';
import { SuggestionsOverlay } from '../overlays/SuggestionsOverlay';
import { SubLogActionOverlay } from '../overlays/SubLogActionOverlay';
import { AboutOverlay } from '../overlays/AboutOverlay';
import { saveMatchResult } from '../firebase/teams';
import { enqueue, subscribePending, flushQueue } from '../firebase/syncQueue';

// Player-list sort modes, cycled by the column sort toggle.
type SortMode = 'max' | 'min' | 'alpha' | 'benchMax' | 'benchMin';

const SORT_ORDER: SortMode[] = ['max', 'min', 'alpha', 'benchMax', 'benchMin'];

const SORT_LABEL: Record<SortMode, string> = {
  max: 'Time↓',
  min: 'Time↑',
  alpha: 'A–Z',
  benchMax: 'Bench↓',
  benchMin: 'Bench↑',
};

const SORT_TITLE: Record<SortMode, string> = {
  max: 'most time on pitch',
  min: 'least time on pitch',
  alpha: 'alphabetical',
  benchMax: 'most times benched',
  benchMin: 'fewest times benched',
};

const nextSort = (m: SortMode): SortMode =>
  SORT_ORDER[(SORT_ORDER.indexOf(m) + 1) % SORT_ORDER.length];

function sortPlayers(list: Player[], mode: SortMode, ms: number): Player[] {
  const arr = list.slice();
  if (mode === 'alpha') {
    arr.sort((a, b) => a.name.localeCompare(b.name));
  } else if (mode === 'min') {
    arr.sort((a, b) => liveTimeOnPitch(a, ms) - liveTimeOnPitch(b, ms));
  } else if (mode === 'benchMax') {
    arr.sort((a, b) => b.benchCount - a.benchCount || liveTimeOnPitch(b, ms) - liveTimeOnPitch(a, ms));
  } else if (mode === 'benchMin') {
    arr.sort((a, b) => a.benchCount - b.benchCount || liveTimeOnPitch(a, ms) - liveTimeOnPitch(b, ms));
  } else {
    arr.sort((a, b) => liveTimeOnPitch(b, ms) - liveTimeOnPitch(a, ms));
  }
  return arr;
}

export function MatchScreen() {
  useTick();

  const players = useMatchStore((s) => s.players);
  const config = useMatchStore((s) => s.config);
  const half = useMatchStore((s) => s.half);
  const timerStartedAt = useMatchStore((s) => s.timerStartedAt);
  const matchOver = useMatchStore((s) => s.matchOver);
  const halfStartOffset = useMatchStore((s) => s.halfStartOffset);
  const accumulatedSeconds = useMatchStore((s) => s.accumulatedSeconds);
  const fullTimeSaved = useMatchStore((s) => s.fullTimeSaved);
  const matchId = useMatchStore((s) => s.matchId);
  const subLog = useMatchStore((s) => s.subLog);

  const toggleTimer = useMatchStore((s) => s.toggleTimer);
  const endMatch = useMatchStore((s) => s.endMatch);
  const markFullTimeSaved = useMatchStore((s) => s.markFullTimeSaved);
  const reset = useMatchStore((s) => s.reset);

  const teamLogo = useTeamStore((s) => s.teamLogo);
  const teamId = useTeamStore((s) => s.teamId);
  const showScreen = useScreenStore((s) => s.show);

  const [halfTimeVisible, setHalfTimeVisible] = useState(false);
  const [ftConfirmVisible, setFtConfirmVisible] = useState(false);
  const [resetVisible, setResetVisible] = useState(false);
  const [optionsId, setOptionsId] = useState<string | null>(null);
  const [addPlayerVisible, setAddPlayerVisible] = useState(false);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [subOrder, setSubOrder] = useState<'latest' | 'earliest'>('latest');
  const [subActionIndex, setSubActionIndex] = useState<number | null>(null);
  const [pitchSort, setPitchSort] = useState<SortMode>('max');
  const [benchSort, setBenchSort] = useState<SortMode>('max');

  // Subscribe to the offline-queue counter.
  useEffect(() => subscribePending(setPendingCount), []);

  // Detect half-end automatically.
  useEffect(() => {
    if (!config) return;
    if (matchOver) return;
    if (timerStartedAt !== null) return;
    // Just paused — check if it was due to half-end.
    const matchSeconds = deriveMatchSeconds(timerStartedAt, accumulatedSeconds);
    const halfElapsed = matchSeconds - halfStartOffset;
    if (halfElapsed >= config.minutes * 60 && half < config.periods) {
      setHalfTimeVisible(true);
    }
  }, [timerStartedAt, accumulatedSeconds, halfStartOffset, half, config, matchOver]);

  // On full time, write season stats once.
  useEffect(() => {
    if (!matchOver || fullTimeSaved || !config || !teamId || !matchId) return;
    markFullTimeSaved();
    const state = useMatchStore.getState();
    const matchSeconds = deriveMatchSeconds(state.timerStartedAt, state.accumulatedSeconds);

    const playerStats: Record<string, { minutesPlayed: number; subCount: number }> = {};
    state.players.forEach((p) => {
      if (!p.firestoreId) return;
      const finalTime = liveTimeOnPitch(p, matchSeconds);
      playerStats[p.firestoreId] = {
        minutesPlayed: Math.floor(finalTime / 60),
        subCount: p.subCount,
      };
    });

    void (async () => {
      try {
        await saveMatchResult({
          teamId,
          matchId,
          halfLength: config.minutes,
          halves: config.periods,
          teamSize: config.teamSize,
          playerStats,
        });
      } catch {
        enqueue({
          matchId,
          teamId,
          payload: {
            date: Date.now(),
            halfLength: config.minutes,
            halves: config.periods,
            teamSize: config.teamSize,
            playerStats,
          },
          playerIncrements: {},
          attempts: 0,
          queuedAt: Date.now(),
        });
      }
    })();
  }, [matchOver, fullTimeSaved, config, teamId, matchId, markFullTimeSaved]);

  const halfLabel = useMemo(() => {
    if (!config) return '';
    if (config.periods === 1) return 'Period';
    return half === 1 ? '1st Half' : half === 2 ? '2nd Half' : `Period ${half}`;
  }, [half, config]);

  if (!config) return null;

  const sortSeconds = deriveMatchSeconds(timerStartedAt, accumulatedSeconds);
  const onPitch = sortPlayers(players.filter((p) => p.onPitch), pitchSort, sortSeconds);
  const onBench = sortPlayers(players.filter((p) => !p.onPitch), benchSort, sortSeconds);

  const stagedSubs = useMatchStore.getState().stagedSubs;
  const stagedSoloOn = stagedSubs.filter((s) => s.kind === 'fill').length;
  const totalEmpty = config.teamSize - onPitch.length;
  const freeEmpty = totalEmpty - stagedSoloOn;
  const subTotal = subLog.reduce((n, e) => n + e.pairs.length, 0);

  const halfBtnLabel = half < config.periods ? 'H/T' : 'F/T';

  return (
    <div id="match-screen" className="screen match-screen">
      <header className="match-header">
        {teamLogo && (
          <img src={teamLogo} alt="" className="team-logo" onClick={() => setAboutVisible(true)} />
        )}
        <div>
          <div id="half-label" className="half-indicator">{halfLabel}</div>
          <Clock />
          <NextSubCountdown />
        </div>
        <div className="timer-controls">
          <button
            id="timer-btn"
            className="ctrl-btn green"
            disabled={matchOver}
            onClick={toggleTimer}
            title={timerStartedAt !== null ? 'Pause' : 'Play'}
          >
            {timerStartedAt !== null ? '⏸' : '▶'}
          </button>
          <button
            id="half-btn"
            className="ctrl-btn amber"
            disabled={matchOver}
            onClick={() => {
              if (half < config.periods) {
                // pause and open H/T
                if (timerStartedAt !== null) toggleTimer();
                setHalfTimeVisible(true);
              } else {
                setFtConfirmVisible(true);
              }
            }}
            title={half < config.periods ? 'Half-time' : 'Full-time'}
          >
            {halfBtnLabel}
          </button>
          <button
            id="rec-btn"
            className="ctrl-btn"
            disabled={matchOver}
            onClick={() => setSuggestionsVisible(true)}
            title="Suggest substitutions"
          >
            ★
          </button>
          <button
            id="add-player-btn"
            className="ctrl-btn add"
            disabled={matchOver}
            onClick={() => setAddPlayerVisible(true)}
            title="Add player to bench"
          >
            +
          </button>
          <button
            id="reset-btn"
            className="ctrl-btn danger"
            onClick={() => setResetVisible(true)}
            title="Discard match"
          >
            ✕
          </button>
        </div>
      </header>

      {matchOver && (
        <div id="full-time-banner" className="full-time-banner">FULL TIME</div>
      )}

      {pendingCount > 0 && (
        <div className="sync-banner" onClick={() => void flushQueue()}>
          Sync pending — {pendingCount} match{pendingCount === 1 ? '' : 'es'}
        </div>
      )}

      <SubBar />

      <div className="lists">
        <div className="list-section">
          <div className="list-header">
            <span className="list-title">Bench</span>
            <span id="bench-count" className="list-count">({onBench.length})</span>
            {onBench.length > 1 && (
              <SortToggle
                label={SORT_LABEL[benchSort]}
                onClick={() => setBenchSort(nextSort)}
                title={`Bench sorted by ${SORT_TITLE[benchSort]} — tap to change`}
              />
            )}
          </div>
          <div id="bench-list-match" className="player-cards">
            {onBench.map((p) => (
              <PlayerCard key={p.id} player={p} onLongPress={setOptionsId} />
            ))}
          </div>
        </div>

        <div className="list-section">
          <div className="list-header">
            <span className="list-title">Pitch</span>
            <span id="pitch-count" className="list-count">
              ({onPitch.length}/{config.teamSize})
            </span>
            {onPitch.length > 1 && (
              <SortToggle
                label={SORT_LABEL[pitchSort]}
                onClick={() => setPitchSort(nextSort)}
                title={`Pitch sorted by ${SORT_TITLE[pitchSort]} — tap to change`}
              />
            )}
          </div>
          <div id="pitch-list" className="player-cards">
            {onPitch.map((p) => (
              <PlayerCard key={p.id} player={p} onLongPress={setOptionsId} />
            ))}
            {Array.from({ length: stagedSoloOn }).map((_, i) => (
              <EmptySlotCard key={`staged-${i}`} staged />
            ))}
            {Array.from({ length: Math.max(0, freeEmpty) }).map((_, i) => (
              <EmptySlotCard key={`empty-${i}`} staged={false} />
            ))}
          </div>
        </div>

        <div className="list-section">
          <div className="list-header">
            <span className="list-title">Subs</span>
            <span id="sub-count" className="list-count">
              {subTotal > 0 ? `(${subTotal})` : ''}
            </span>
            {subLog.length > 1 && (
              <SortToggle
                label={subOrder === 'latest' ? 'Latest' : 'Earliest'}
                onClick={() => setSubOrder((o) => (o === 'latest' ? 'earliest' : 'latest'))}
                title={`Showing ${subOrder} first — tap to change`}
              />
            )}
          </div>
          <div id="sub-log-entries" className="player-cards sub-log-entries">
            {(subOrder === 'latest'
              ? subLog.map((_, i) => i).reverse()
              : subLog.map((_, i) => i)
            ).map((i) => (
              <SubLogCard
                key={i}
                entry={subLog[i]}
                index={i}
                subNumber={i + 1}
                onLongPress={setSubActionIndex}
              />
            ))}
          </div>
        </div>
      </div>

      <HalfTimeOverlay
        visible={halfTimeVisible}
        onDismiss={() => setHalfTimeVisible(false)}
      />
      <FullTimeConfirmOverlay
        visible={ftConfirmVisible}
        onCancel={() => setFtConfirmVisible(false)}
        onConfirm={() => {
          setFtConfirmVisible(false);
          endMatch();
        }}
      />
      <FullTimeOverlay visible={matchOver} />
      <ResetOverlay
        visible={resetVisible}
        onCancel={() => setResetVisible(false)}
        onConfirm={() => {
          setResetVisible(false);
          reset();
          showScreen('match-setup');
        }}
      />
      <PlayerOptionsOverlay playerId={optionsId} onDismiss={() => setOptionsId(null)} />
      <AddPlayerOverlay
        visible={addPlayerVisible}
        onDismiss={() => setAddPlayerVisible(false)}
      />
      <SuggestionsOverlay
        visible={suggestionsVisible}
        onDismiss={() => setSuggestionsVisible(false)}
      />
      <SubLogActionOverlay
        index={subActionIndex}
        onDismiss={() => setSubActionIndex(null)}
      />
      <AboutOverlay visible={aboutVisible} onDismiss={() => setAboutVisible(false)} />
    </div>
  );
}
