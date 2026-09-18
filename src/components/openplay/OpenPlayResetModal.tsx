import React from 'react';
import { ResetSessionModal } from '../ResetSessionModal';

interface OpenPlayResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetKeepPlayers: () => void;
  onResetFull: () => void;
  playersCount: number;
  activeMatchesCount: number;
  historyCount: number;
}

export const OpenPlayResetModal: React.FC<OpenPlayResetModalProps> = ({
  isOpen,
  onClose,
  onResetKeepPlayers,
  onResetFull,
  playersCount,
  activeMatchesCount,
  historyCount,
}) => {
  return (
    <ResetSessionModal
      isOpen={isOpen}
      onClose={onClose}
      mode="openplay"
      playersCount={playersCount}
      activeMatchesCount={activeMatchesCount}
      historyCount={historyCount}
      onResetKeepPlayers={onResetKeepPlayers}
      onResetFull={onResetFull}
    />
  );
};
