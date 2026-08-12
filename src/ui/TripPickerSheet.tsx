import { useState } from 'react';
import type { Trip } from '../domain/types';
import { useI18n } from '../i18n/LangContext';
import { Sheet } from './Sheet';
import { WheelPicker } from './WheelPicker';

type Props = {
  trips: Trip[];
  activeTripId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
};

export function TripPickerSheet({ trips, activeTripId, onSelect, onClose }: Props) {
  const { t } = useI18n();
  // 「決定」を押すまでは確定させない。✕ や背景タップで閉じたら選択を捨てる。
  const [pickedId, setPickedId] = useState(activeTripId);

  return (
    <Sheet title={t.tripPicker.title} onClose={onClose}>
      <WheelPicker
        items={trips.map((trip) => ({ id: trip.id, label: trip.name }))}
        selectedId={pickedId}
        onChange={setPickedId}
        label={t.tripPicker.label}
      />
      <div className="form-actions">
        <button type="button" className="btn-primary" onClick={() => onSelect(pickedId)}>
          {t.common.confirm}
        </button>
      </div>
    </Sheet>
  );
}
