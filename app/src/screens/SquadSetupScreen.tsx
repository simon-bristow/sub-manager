import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useTeamStore } from '../state/useTeamStore';
import { useScreenStore } from '../state/useScreenStore';
import { useConfigStore } from '../state/useConfigStore';
import { useMatchStore } from '../state/useMatchStore';
import type { RosterEntry, Player } from '../domain/types';
import {
  loadPlayersFromFirestore,
  addPlayerToTeam,
  removePlayerFromTeam,
} from '../firebase/teams';
import { Overlay } from '../components/Overlay';
import { useLongPress } from '../hooks/useLongPress';

type Group = 'pitch' | 'bench' | 'absent';

interface RosterCardProps {
  entry: RosterEntry;
  onTap: (name: string) => void;
  onLongPress: (name: string) => void;
}

function RosterCard({ entry, onTap, onLongPress }: RosterCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: entry.name });
  // dnd-kit PointerSensor uses onPointerDown; useLongPress uses onMouseDown/onTouchStart — no conflict.
  const lp = useLongPress(
    () => { if (!isDragging) onLongPress(entry.name); },
    () => onTap(entry.name),
  );
  return (
    <div
      ref={setNodeRef}
      className={`roster-card ${entry.group}-card${isDragging ? ' is-dragging' : ''}`}
      {...attributes}
      {...listeners}
      {...lp}
    >
      {entry.name}
    </div>
  );
}

interface ZoneProps {
  zone: Group | 'gk';
  label: string;
  count: string;
  className: string;
  children: React.ReactNode;
}

function Zone({ zone, label, count, className, children }: ZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: zone });
  return (
    <div
      ref={setNodeRef}
      className={`setup-zone ${className}${isOver ? ' drag-over' : ''}`}
      data-zone={zone}
    >
      <div className="zone-header">
        <span className="zone-label">{label}</span>
        <span className="zone-count">{count}</span>
      </div>
      {children}
    </div>
  );
}

export function SquadSetupScreen() {
  const teamId = useTeamStore((s) => s.teamId);
  const teamName = useTeamStore((s) => s.teamName);
  const teamLogo = useTeamStore((s) => s.teamLogo);
  const config = useConfigStore((s) => s.config);
  const showScreen = useScreenStore((s) => s.show);
  const startMatch = useMatchStore((s) => s.startMatch);

  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [gkName, setGkName] = useState<string | null>(null);
  const [fillIn, setFillIn] = useState('');
  const [error, setError] = useState('');
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  useEffect(() => {
    if (!teamId) return;
    void loadPlayersFromFirestore(teamId).then((players) => {
      setRoster(
        players.map((p) => ({ name: p.name, group: 'absent', firestoreId: p.id })),
      );
    });
  }, [teamId]);

  const pitchCount = roster.filter((r) => r.group === 'pitch').length;

  const grouped = useMemo(() => {
    const sortByName = (a: RosterEntry, b: RosterEntry) => a.name.localeCompare(b.name);
    return {
      pitch: roster.filter((r) => r.group === 'pitch' && r.name !== gkName).sort(sortByName),
      bench: roster.filter((r) => r.group === 'bench').sort(sortByName),
      absent: roster.filter((r) => r.group === 'absent').sort(sortByName),
    };
  }, [roster, gkName]);

  const gkEntry = gkName ? roster.find((r) => r.name === gkName) : null;

  function move(name: string, target: Group) {
    setRoster((r) => {
      const p = r.find((x) => x.name === name);
      if (!p) return r;
      // Cap pitch.
      if (target === 'pitch' && p.group !== 'pitch') {
        const onPitch = r.filter((x) => x.group === 'pitch').length;
        if (onPitch >= config.teamSize) return r;
      }
      return r.map((x) => (x.name === name ? { ...x, group: target } : x));
    });
    if (target !== 'pitch' && gkName === name) setGkName(null);
  }

  function tap(name: string) {
    setRoster((r) => {
      const p = r.find((x) => x.name === name);
      if (!p) return r;
      const onPitch = r.filter((x) => x.group === 'pitch').length;
      let next: Group;
      if (p.group === 'absent' || p.group === 'bench') {
        next = onPitch < config.teamSize ? 'pitch' : 'bench';
      } else {
        next = 'absent';
        if (gkName === name) setGkName(null);
      }
      return r.map((x) => (x.name === name ? { ...x, group: next } : x));
    });
  }

  const onDragStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
  };

  const onDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const name = String(e.active.id);
    if (!e.over) return;
    const target = String(e.over.id);
    if (target === 'gk') {
      setGkName(name);
      setRoster((r) =>
        r.map((x) => (x.name === name && x.group === 'absent' ? { ...x, group: 'pitch' } : x)),
      );
      return;
    }
    if (target === 'pitch' || target === 'bench' || target === 'absent') {
      move(name, target);
    }
  };

  const addFillIn = async () => {
    const name = fillIn.trim();
    if (!name) return;
    if (roster.some((r) => r.name.toLowerCase() === name.toLowerCase())) {
      setError(`"${name}" is already in the squad.`);
      return;
    }
    setError('');
    setFillIn('');
    let firestoreId: string | null = null;
    if (teamId) {
      try {
        firestoreId = await addPlayerToTeam(teamId, name);
      } catch {
        /* non-fatal */
      }
    }
    setRoster((r) => [...r, { name, group: 'absent', firestoreId }]);
  };

  const onConfirmRemove = async () => {
    const name = removeTarget;
    setRemoveTarget(null);
    if (!name) return;
    const p = roster.find((r) => r.name === name);
    if (p?.firestoreId && teamId) {
      try {
        await removePlayerFromTeam(teamId, p.firestoreId);
      } catch {
        /* ignore */
      }
    }
    if (name === gkName) setGkName(null);
    setRoster((r) => r.filter((x) => x.name !== name));
  };

  const onStart = () => {
    const starters = roster.filter((p) => p.group === 'pitch');
    const bench = roster.filter((p) => p.group === 'bench');
    if (starters.length === 0) {
      setError('Add at least one player to the starting lineup.');
      return;
    }
    const all = [...starters, ...bench];
    const players: Player[] = all.map((p, i) => ({
      id: `${i}-${p.name}`,
      firestoreId: p.firestoreId,
      name: p.name,
      isGK: p.name === gkName,
      onPitch: i < starters.length,
      accumulatedTime: 0,
      lastOnAt: i < starters.length ? 0 : null,
      subCount: 0,
      // Players starting on the bench begin with a bench count of 1.
      benchCount: i < starters.length ? 0 : 1,
    }));
    const matchId = crypto.randomUUID();
    startMatch({ matchId, config, players });
    showScreen('match');
  };

  return (
    <div id="setup-screen" className="screen setup-screen">
      <header className="setup-header">
        {teamLogo && <img id="setup-logo" src={teamLogo} alt="" className="setup-logo" />}
        <div className="setup-header-text">
          <div className="setup-title">Squad</div>
          <div id="squad-setup-team-name" className="setup-sub">{teamName}</div>
        </div>
      </header>

      <div className="match-summary">
        <span id="match-summary-text">
          {config.periods === 1 ? `${config.minutes} min` : `${config.periods} × ${config.minutes} min`}
          {' · '}
          {config.teamSize}-a-side
          {' · '}
          Sub alert {config.alertMins} min
        </span>
        <button className="edit-link" onClick={() => showScreen('match-setup')}>Edit</button>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd}>
        <div className="setup-zones">
          <Zone
            zone="absent"
            label="Squad"
            count={grouped.absent.length ? String(grouped.absent.length) : ''}
            className="setup-zone-absent"
          >
            <div id="absent-cards" className="zone-cards">
              {grouped.absent.map((e) => (
                <RosterCard
                  key={e.name}
                  entry={e}
                  onTap={tap}
                  onLongPress={setRemoveTarget}
                />
              ))}
            </div>
          </Zone>

          <Zone
            zone="bench"
            label="Bench"
            count={grouped.bench.length ? String(grouped.bench.length) : ''}
            className="setup-zone-bench"
          >
            <div id="bench-cards" className="zone-cards">
              {grouped.bench.map((e) => (
                <RosterCard
                  key={e.name}
                  entry={e}
                  onTap={tap}
                  onLongPress={setRemoveTarget}
                />
              ))}
            </div>
          </Zone>

          <Zone
            zone="pitch"
            label={`Starting ${config.teamSize}`}
            count={`${pitchCount}/${config.teamSize}`}
            className="setup-zone-pitch"
          >
            <GKSlot gkEntry={gkEntry} onTap={tap} onLongPress={setRemoveTarget} />
            <div id="pitch-cards" className="zone-cards">
              {grouped.pitch.map((e) => (
                <RosterCard
                  key={e.name}
                  entry={e}
                  onTap={tap}
                  onLongPress={setRemoveTarget}
                />
              ))}
              {Array.from({ length: Math.max(0, config.teamSize - 1 - grouped.pitch.length - (gkEntry ? 0 : 0)) }).map((_, i) => (
                <div key={`empty-${i}`} className="empty-slot-card setup-empty" />
              ))}
            </div>
          </Zone>
        </div>
        <DragOverlay>
          {activeId ? <div className="drag-ghost roster-card">{activeId}</div> : null}
        </DragOverlay>
      </DndContext>

      <div className="add-player-row">
        <input
          id="fillin-input"
          type="text"
          className="new-player-input"
          placeholder="Add player"
          value={fillIn}
          onChange={(e) => setFillIn(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void addFillIn();
          }}
        />
        <button id="add-fillin-btn" className="new-player-btn" onClick={() => void addFillIn()}>+</button>
      </div>

      <div id="setup-error" className="setup-error">{error}</div>

      <button
        id="start-btn"
        className="primary-btn start-btn"
        disabled={pitchCount === 0}
        onClick={onStart}
      >
        Start Match
      </button>

      <Overlay visible={!!removeTarget} onBackdrop={() => setRemoveTarget(null)}>
        <h2>Remove player?</h2>
        <p id="remove-squad-player-title"><strong>{removeTarget}</strong></p>
        <p>Their season stats will also be deleted.</p>
        <div className="overlay-actions">
          <button onClick={() => setRemoveTarget(null)}>Cancel</button>
          <button className="danger" onClick={() => void onConfirmRemove()}>Remove</button>
        </div>
      </Overlay>
    </div>
  );
}

function GKSlot({
  gkEntry,
  onTap,
  onLongPress,
}: {
  gkEntry: RosterEntry | null | undefined;
  onTap: (n: string) => void;
  onLongPress: (n: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'gk' });
  return (
    <div
      ref={setNodeRef}
      id="gk-slot"
      className={`gk-slot${isOver ? ' drag-over' : ''}`}
    >
      <span className="gk-badge">GK</span>
      {gkEntry && <RosterCard entry={gkEntry} onTap={onTap} onLongPress={onLongPress} />}
    </div>
  );
}
