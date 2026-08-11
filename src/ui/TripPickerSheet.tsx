import { useState } from 'react';
import type { Trip } from '../domain/types';
import { Sheet } from './Sheet';
import { WheelPicker } from './WheelPicker';

type Props = {
  trips: Trip[];
  activeTripId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function TripPickerSheet({ trips, activeTripId, onSelect, onClose }: Props) {
  // 「決定」を押すまでは確定させない。✕ や背景タップで閉じたら選択を捨てる。
  const [pickedId, setPickedId] = useState(activeTripId);

  return (
    <Sheet title="旅行を選ぶ" onClose={onClose}>
      <WheelPicker
        items={trips.map((t) => ({ id: t.id, label: t.name }))}
        selectedId={pickedId}
        onChange={setPickedId}
        label="旅行"
      />
      <div className="form-actions">
        <button type="button" className="btn-primary" onClick={() => onSelect(pickedId)}>
          決定
        </button>
      </div>
    </Sheet>
  );
}
