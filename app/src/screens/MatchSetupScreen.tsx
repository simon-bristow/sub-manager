import { useConfigStore } from '../state/useConfigStore';
import { useTeamStore } from '../state/useTeamStore';
import { useScreenStore } from '../state/useScreenStore';
import { configErrors, configIsValid, BOUNDS } from '../domain/validation';
import type { MatchConfig } from '../domain/types';

type Key = keyof MatchConfig;

interface RowProps {
  label: string;
  field: Key;
  options: number[];
  value: number;
  onChange: (v: number) => void;
  error?: string;
}

function ConfigRow({ label, field, options, value, onChange, error }: RowProps) {
  const preset = options.includes(value);
  return (
    <div className="config-row">
      <div className="config-label">{label}</div>
      <div className="config-options" id={`config-${field}`}>
        {options.map((o) => (
          <button
            key={o}
            className={`config-btn${value === o ? ' selected' : ''}`}
            onClick={() => onChange(o)}
          >
            {o}
          </button>
        ))}
        <input
          type="number"
          className={`config-custom${!preset ? ' selected' : ''}`}
          placeholder="…"
          value={!preset ? value : ''}
          min={BOUNDS[field].min}
          max={BOUNDS[field].max}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (Number.isFinite(v)) onChange(v);
          }}
        />
      </div>
      {error && <div className="config-error">{error}</div>}
    </div>
  );
}

export function MatchSetupScreen() {
  const config = useConfigStore((s) => s.config);
  const setConfig = useConfigStore((s) => s.setConfig);
  const teamName = useTeamStore((s) => s.teamName);
  const teamLogo = useTeamStore((s) => s.teamLogo);
  const showScreen = useScreenStore((s) => s.show);
  const errors = configErrors(config);
  const valid = configIsValid(config);

  return (
    <div id="match-setup-screen" className="screen match-setup-screen">
      <header className="setup-header">
        {teamLogo && <img id="setup-logo-match" src={teamLogo} alt="" className="setup-logo" />}
        <div className="setup-header-text">
          <div className="setup-title">Match Setup</div>
          <div id="match-setup-team-name" className="setup-sub">
            {teamName}{' '}
            <button className="edit-link" onClick={() => showScreen('team-select')}>Change</button>
          </div>
        </div>
      </header>

      <div className="match-config">
        <ConfigRow
          label="Halves"
          field="periods"
          options={[1, 2]}
          value={config.periods}
          onChange={(v) => setConfig({ periods: v as MatchConfig['periods'] })}
          error={errors.periods}
        />
        <ConfigRow
          label="Mins per half"
          field="minutes"
          options={[20, 30, 40, 45]}
          value={config.minutes}
          onChange={(v) => setConfig({ minutes: v })}
          error={errors.minutes}
        />
        <ConfigRow
          label="Team size"
          field="teamSize"
          options={[5, 7, 9, 11]}
          value={config.teamSize}
          onChange={(v) => setConfig({ teamSize: v })}
          error={errors.teamSize}
        />
        <ConfigRow
          label="Sub alert (min)"
          field="alertMins"
          options={[5, 10, 15, 20]}
          value={config.alertMins}
          onChange={(v) => setConfig({ alertMins: v })}
          error={errors.alertMins}
        />
      </div>

      <button
        id="goto-squad-btn"
        className="start-btn"
        disabled={!valid}
        onClick={() => showScreen('squad-setup')}
      >
        Next: Squad →
      </button>
    </div>
  );
}
