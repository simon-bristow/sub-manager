import { useLongPress } from '../hooks/useLongPress';
import type { SubLogEntry } from '../domain/types';

interface Props {
  entry: SubLogEntry;
  index: number;
  subNumber: number;
  onLongPress: (index: number) => void;
}

export function SubLogCard({ entry, index, subNumber, onLongPress }: Props) {
  const ons = entry.pairs.map((p) => p.onName);
  const offs = entry.pairs.map((p) => p.offName).filter((n): n is string => !!n);
  const handlers = useLongPress(
    () => onLongPress(index),
    () => {},
  );
  return (
    <div className="sub-log-entry" {...handlers}>
      <div className="log-header">
        <span className="log-order">#{subNumber}</span>
        <span className="log-time">{entry.minute}'</span>
      </div>
      <div className="log-pairs">
        <div className="log-group">
          {ons.map((name, j) => (
            <span key={`on-${j}`} className="log-on">↑{name}</span>
          ))}
        </div>
        {offs.length > 0 && (
          <div className="log-group">
            {offs.map((name, j) => (
              <span key={`off-${j}`} className="log-off">↓{name}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
