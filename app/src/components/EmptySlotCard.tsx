import { useMatchStore } from '../state/useMatchStore';

interface Props {
  staged: boolean;
}

export function EmptySlotCard({ staged }: Props) {
  const pendingOn = useMatchStore((s) => s.pendingOn);
  const stageEmptySlot = useMatchStore((s) => s.stageEmptySlot);
  const onClick = () => {
    if (staged || pendingOn === null) return;
    stageEmptySlot();
  };
  return (
    <div className={`empty-slot-card${staged ? ' active' : ''}`} onClick={onClick}>
      {staged ? '↑ Staged' : 'Empty'}
    </div>
  );
}
